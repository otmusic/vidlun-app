import { AnalysisRefusedError, UnreadableAnalysisError } from '@/domain/errors/AnalysisErrors';
import { ClaudeEchoWriter, describe as describeEntry } from '@/infrastructure/analysis/ClaudeEchoWriter';

import REGISTER from '@/infrastructure/analysis/echoRegister.json';

import { FakeMessagesClient, textReply } from './fakes';

const INPUT = {
  transcript: 'An ordinary day, finished the project.',
  mood: 4,
  emotionIds: ['happy.content'],
  voice: { marks: ['quieter', 'flatter'] as const },
};

describe('ClaudeEchoWriter', () => {
  it('returns the one sentence the model wrote', async () => {
    const client = new FakeMessagesClient(
      textReply(JSON.stringify({ echo: ' The day sounds good, but your voice is quieter than usual. ' })),
    );

    expect(await new ClaudeEchoWriter(client).write(INPUT)).toBe(
      'The day sounds good, but your voice is quieter than usual.',
    );
  });

  it('asks the better model, since nobody waits on it, and constrains the answer', async () => {
    const client = new FakeMessagesClient(textReply(JSON.stringify({ echo: null })));

    await new ClaudeEchoWriter(client).write(INPUT);

    expect(client.requests[0]?.model).toBe('claude-sonnet-5');
    expect(client.requests[0]?.output_config?.format?.type).toBe('json_schema');
  });

  it('gives the model the words first, then what the person kept, then the voice', () => {
    expect(describeEntry(INPUT)).toBe(
      [
        'What was said: An ordinary day, finished the project.',
        'Mood: 4 of 5.',
        'Emotions they chose: happy.content.',
        'Voice: quieter, flatter.',
      ].join('\n'),
    );
    expect(describeEntry({ ...INPUT, mood: null, emotionIds: [], voice: null })).toContain(
      'Mood: none.\nEmotions they chose: none.\nVoice: not measured.',
    );
    expect(describeEntry({ ...INPUT, voice: { marks: [] } })).toContain('Voice: as usual.');
  });

  it('carries the owner\'s tone, the gender rule and every example of the register', async () => {
    const client = new FakeMessagesClient(textReply(JSON.stringify({ echo: null })));

    await new ClaudeEchoWriter(client).write(INPUT);

    const block = client.requests[0]?.system?.[0];
    const prompt = typeof block === 'object' ? block.text : '';

    expect(prompt).toContain('Warm, calm, human and unobtrusive');
    expect(prompt).toContain('only in the present tense');
    for (const line of [...REGISTER.examples, ...REGISTER.gendered]) {
      expect(prompt).toContain(line);
    }
    expect(prompt).not.toContain('${');
  });

  it('takes null, or an empty sentence, as nothing to say', async () => {
    for (const echo of [null, '   ']) {
      const client = new FakeMessagesClient(textReply(JSON.stringify({ echo })));

      expect(await new ClaudeEchoWriter(client).write(INPUT)).toBeNull();
    }
  });

  it('refuses an answer that is not an echo', async () => {
    for (const reply of ['', 'not json', '[]', JSON.stringify({ echo: 4 })]) {
      const client = new FakeMessagesClient(textReply(reply));

      await expect(new ClaudeEchoWriter(client).write(INPUT)).rejects.toBeInstanceOf(UnreadableAnalysisError);
    }
  });

  it('says so when the model refuses', async () => {
    const client = new FakeMessagesClient({ stop_reason: 'refusal', content: [] });

    await expect(new ClaudeEchoWriter(client).write(INPUT)).rejects.toBeInstanceOf(AnalysisRefusedError);
  });
});
