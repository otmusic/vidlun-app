import { AnalysisRefusedError, UnreadableAnalysisError } from '@/domain/errors/AnalysisErrors';
import { ClaudeObservationWriter } from '@/infrastructure/analysis/ClaudeObservationWriter';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import { FakeMessagesClient, textReply } from './fakes';

function said(observation: string | null): FakeMessagesClient {
  return new FakeMessagesClient(textReply(JSON.stringify({ observation })));
}

describe('ClaudeObservationWriter', () => {
  it('returns the sentence Luna says out loud', async () => {
    const client = said('Sounds like the good kind of tired.');

    expect(await new ClaudeObservationWriter(client).observe('raw words')).toBe(
      'Sounds like the good kind of tired.',
    );
  });

  it('carries silence through as silence', async () => {
    expect(await new ClaudeObservationWriter(said(null)).observe('Cooked dinner.')).toBeNull();
  });

  it('asks the model that writes readable Ukrainian, not the cheap one', async () => {
    const client = said(null);

    await new ClaudeObservationWriter(client).observe('raw words');

    expect(client.requests[0]?.model).toBe('claude-sonnet-5');
  });

  it('leaves the emotion vocabulary out, having no use for it', async () => {
    const client = said(null);

    await new ClaudeObservationWriter(client).observe('raw words');

    const prompt = JSON.stringify(client.requests[0]?.system);
    const anyEmotion = createEmotionVocabulary().all()[0]?.id ?? 'happy';

    expect(prompt).not.toContain(anyEmotion);
  });

  it('reports a refusal rather than returning a sentence nobody wrote', async () => {
    const client = new FakeMessagesClient({
      ...textReply('{}'),
      stop_reason: 'refusal',
    });

    await expect(new ClaudeObservationWriter(client).observe('raw words')).rejects.toThrow(
      AnalysisRefusedError,
    );
  });

  it.each([
    ['nothing at all', ''],
    ['something that is not JSON', 'sounds tired'],
    ['a JSON array', '[]'],
  ])('refuses %s', async (_label, raw) => {
    const client = new FakeMessagesClient(textReply(raw));

    await expect(new ClaudeObservationWriter(client).observe('raw words')).rejects.toThrow(
      UnreadableAnalysisError,
    );
  });
});
