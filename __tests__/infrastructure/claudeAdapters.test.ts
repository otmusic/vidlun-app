import { MoodEntry } from '@/domain/entities/MoodEntry';
import { AnalysisRefusedError, UnreadableAnalysisError } from '@/domain/errors/AnalysisErrors';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { ClaudeNarrativeGenerator } from '@/infrastructure/analysis/ClaudeNarrativeGenerator';
import { ClaudeReflectionAnalyzer } from '@/infrastructure/analysis/ClaudeReflectionAnalyzer';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import { FakeMessagesClient, textReply } from './fakes';

const vocabulary = createEmotionVocabulary();

const PROPOSAL = {
  cleanTranscript: 'Finished three tasks, happy, but very tired.',
  mood: 4,
  emotionIds: ['happy.proud.successful', 'bad.tired.drained'],
  contextTags: ['work'],
  safetyFlag: 'none',
};

describe('ClaudeReflectionAnalyzer', () => {
  it('returns the model proposal as a typed draft', async () => {
    const client = new FakeMessagesClient(textReply(JSON.stringify(PROPOSAL)));

    const proposal = await new ClaudeReflectionAnalyzer(client, vocabulary).analyze('raw words');

    expect(proposal).toEqual(PROPOSAL);
  });

  it('asks the cheap model and constrains the answer to a schema', async () => {
    const client = new FakeMessagesClient(textReply(JSON.stringify(PROPOSAL)));

    await new ClaudeReflectionAnalyzer(client, vocabulary).analyze('raw words');

    const request = client.requests[0];

    // Affordable again now that the transcript is passed through rather than
    // repaired: the rule this model could not keep no longer exists. §1f.
    expect(request?.model).toBe('claude-haiku-4-5');
    expect(request?.output_config?.format?.type).toBe('json_schema');
    expect(request?.output_config?.effort).toBeUndefined();
  });

  it('offers the model no sensitive emotion to choose from', async () => {
    const client = new FakeMessagesClient(textReply(JSON.stringify(PROPOSAL)));

    await new ClaudeReflectionAnalyzer(client, vocabulary).analyze('raw words');

    const system = JSON.stringify(client.requests[0]?.system);
    const sensitive = vocabulary.all().filter((emotion) => !emotion.isProposableByAi);

    expect(sensitive.length).toBeGreaterThan(0);
    for (const emotion of sensitive) {
      expect(system).not.toContain(emotion.id);
    }
    expect(system).toContain('bad.tired.drained');
  });

  it('tells the model that an empty emotion list is a correct answer', async () => {
    const client = new FakeMessagesClient(textReply(JSON.stringify(PROPOSAL)));

    await new ClaudeReflectionAnalyzer(client, vocabulary).analyze('raw words');

    expect(JSON.stringify(client.requests[0]?.system)).toContain('An empty array is a correct');
  });

  it('reports a refusal instead of returning an empty draft', async () => {
    const client = new FakeMessagesClient({
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: null, explanation: 'declined' },
      content: [],
    });

    await expect(
      new ClaudeReflectionAnalyzer(client, vocabulary).analyze('raw words'),
    ).rejects.toThrow(AnalysisRefusedError);
  });

  it.each([
    ['no text at all', ''],
    ['something that is not JSON', 'I think you had a nice day!'],
    ['a JSON array', '[]'],
    ['an object missing a field', '{"mood": 4}'],
    ['a field of the wrong type', JSON.stringify({ ...PROPOSAL, emotionIds: 'happy' })],
  ])('refuses to build a draft out of %s', async (_label, text) => {
    const client = new FakeMessagesClient(textReply(text));

    await expect(
      new ClaudeReflectionAnalyzer(client, vocabulary).analyze('raw words'),
    ).rejects.toThrow(UnreadableAnalysisError);
  });

  it('reads an unknown safety flag as no flag rather than failing the entry', async () => {
    const client = new FakeMessagesClient(
      textReply(JSON.stringify({ ...PROPOSAL, safetyFlag: 'spicy' })),
    );

    const proposal = await new ClaudeReflectionAnalyzer(client, vocabulary).analyze('raw words');

    expect(proposal.safetyFlag).toBe('none');
  });

});

describe('ClaudeNarrativeGenerator', () => {
  function entry(id: string, day: number, mood: number): MoodEntry {
    return MoodEntry.create({
      id,
      createdAt: new Date(2026, 6, day, 9, 0),
      source: 'voice',
      rawTranscript: 'raw',
      cleanTranscript: 'Something happened today.',
      mood: MoodScore.of(mood),
      emotionIds: ['bad.tired'],
      contextTags: ['work'],
      confidence: Confidence.of(0.9),
    });
  }

  it('returns the written week', async () => {
    const client = new FakeMessagesClient(textReply('Calmer mornings, tense evenings.'));

    const narrative = await new ClaudeNarrativeGenerator(client).generate([entry('a', 27, 5)]);

    expect(narrative).toBe('Calmer mornings, tense evenings.');
  });

  it('uses the stronger model without paying it to deliberate', async () => {
    const client = new FakeMessagesClient(textReply('A week.'));

    await new ClaudeNarrativeGenerator(client).generate([entry('a', 27, 5)]);

    const request = client.requests[0];

    expect(request?.model).toBe('claude-sonnet-5');
    expect(request?.thinking).toEqual({ type: 'disabled' });
    expect(request?.output_config?.effort).toBe('low');
  });

  it('hands the model every entry it was given', async () => {
    const client = new FakeMessagesClient(textReply('A week.'));

    await new ClaudeNarrativeGenerator(client).generate([entry('a', 27, 5), entry('b', 31, 2)]);

    const content = client.requests[0]?.messages[0]?.content;

    expect(JSON.stringify(content)).toContain('2026-07-27');
    expect(JSON.stringify(content)).toContain('2026-07-31');
    expect(JSON.stringify(content)).toContain('mood 5');
  });

  it('describes an ordinary day without inventing emotions or tags for it', async () => {
    const client = new FakeMessagesClient(textReply('A week.'));
    const mundane = MoodEntry.create({
      id: 'a',
      createdAt: new Date(2026, 6, 27, 9, 0),
      source: 'text',
      rawTranscript: 'Cooked dinner.',
      cleanTranscript: 'Cooked dinner.',
      mood: MoodScore.of(3),
      confidence: Confidence.of(1),
    });

    await new ClaudeNarrativeGenerator(client).generate([mundane]);

    expect(JSON.stringify(client.requests[0]?.messages[0]?.content)).toContain(
      'emotions: none | about: none',
    );
  });

  it('reports a refusal rather than saving an empty week', async () => {
    const client = new FakeMessagesClient({
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: null, explanation: 'declined' },
      content: [],
    });

    await expect(new ClaudeNarrativeGenerator(client).generate([entry('a', 27, 5)])).rejects.toThrow(
      AnalysisRefusedError,
    );
  });

  it('reports a reply that carried no words', async () => {
    const client = new FakeMessagesClient(textReply('   '));

    await expect(new ClaudeNarrativeGenerator(client).generate([entry('a', 27, 5)])).rejects.toThrow(
      UnreadableAnalysisError,
    );
  });
});
