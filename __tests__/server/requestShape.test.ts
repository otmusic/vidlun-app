import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { ClaudeNarrativeGenerator } from '@/infrastructure/analysis/ClaudeNarrativeGenerator';
import { ClaudeReflectionAnalyzer } from '@/infrastructure/analysis/ClaudeReflectionAnalyzer';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';

import { shapeRequest } from '../../server/src/requestShape';
import { FakeMessagesClient, textReply } from '../infrastructure/fakes';

const PROPOSAL = {
  cleanTranscript: 'Cooked dinner.',
  mood: 3,
  emotionIds: [],
  nearbyEmotionIds: [],
  contextTags: [],
  safetyFlag: 'none',
};

async function reflectionBodies(): Promise<readonly unknown[]> {
  const client = new FakeMessagesClient(textReply(JSON.stringify(PROPOSAL)));
  const analyzer = new ClaudeReflectionAnalyzer(client, createEmotionVocabulary());

  await analyzer.analyze('Cooked dinner.', null);
  await analyzer.analyze('Cooked dinner.', { marks: ['quieter'] });

  return client.requests;
}

async function narrativeBody(): Promise<unknown> {
  const client = new FakeMessagesClient(textReply('The month started quietly.'));
  const entry = MoodEntry.create({
    id: 'e1',
    createdAt: new Date('2026-11-02T20:00:00Z'),
    source: 'voice',
    rawTranscript: 'Cooked dinner.',
    cleanTranscript: 'Cooked dinner.',
    mood: MoodScore.of(3),
    emotionIds: [],
    contextTags: [],
    observation: null,
    confidence: Confidence.of(0.9),
    safetyFlag: 'none',
  });

  await new ClaudeNarrativeGenerator(client).generate([entry]);

  return client.requests[0];
}

function withField(body: unknown, field: string, value: unknown): Record<string, unknown> {
  return { ...(body as Record<string, unknown>), [field]: value };
}

describe('the proxy rebuilds what the app may ask Claude for', () => {
  it('passes every reflection the app sends, unchanged, as a Haiku call', async () => {
    for (const body of await reflectionBodies()) {
      const shaped = shapeRequest(body);

      expect(shaped).toEqual({ ok: true, kind: 'haiku', body });
    }
  });

  it('passes the month the app sends, unchanged, as a Sonnet call', async () => {
    const body = await narrativeBody();

    expect(shapeRequest(body)).toEqual({ ok: true, kind: 'sonnet', body });
  });

  it('passes the year echo the app sent until 1.10', () => {
    const echo = {
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: [{ type: 'text', text: 'Echo rules.', cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: { type: 'object' } } },
      messages: [{ role: 'user', content: 'A year ago: tired, work.' }],
    };

    expect(shapeRequest(echo)).toEqual({ ok: true, kind: 'haiku', body: echo });
  });

  it('refuses tools, streaming and any other field the app never sends', async () => {
    const [body] = await reflectionBodies();

    for (const [field, value] of [
      ['tools', [{ type: 'web_search_20250305', name: 'web_search' }]],
      ['tool_choice', { type: 'auto' }],
      ['stream', true],
      ['mcp_servers', []],
      ['metadata', { user_id: 'x' }],
    ] as const) {
      expect(shapeRequest(withField(body, field, value)).ok).toBe(false);
    }
  });

  it('refuses a conversation, an assistant turn or anything but text', async () => {
    const [body] = await reflectionBodies();

    const twoTurns = withField(body, 'messages', [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ]);
    const assistant = withField(body, 'messages', [{ role: 'assistant', content: 'a' }]);
    const image = withField(body, 'messages', [
      { role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://x' } }] },
    ]);

    expect(shapeRequest(twoTurns).ok).toBe(false);
    expect(shapeRequest(assistant).ok).toBe(false);
    expect(shapeRequest(image).ok).toBe(false);
  });

  it('holds each model to the longest answer the app asks it for', async () => {
    const [reflection] = await reflectionBodies();
    const month = await narrativeBody();

    expect(shapeRequest(withField(reflection, 'max_tokens', 4096)).ok).toBe(false);
    expect(shapeRequest(withField(month, 'max_tokens', 2048)).ok).toBe(false);
    expect(shapeRequest(withField(month, 'max_tokens', 1.5)).ok).toBe(false);
  });

  it('refuses a model it does not serve, thinking turned on, and a cache it does not use', async () => {
    const [reflection] = await reflectionBodies();
    const month = await narrativeBody();

    expect(shapeRequest(withField(reflection, 'model', 'claude-opus-5-5')).ok).toBe(false);
    expect(shapeRequest(withField(month, 'thinking', { type: 'enabled', budget_tokens: 1024 })).ok).toBe(false);
    expect(
      shapeRequest(
        withField(reflection, 'system', [
          { type: 'text', text: 'rules', cache_control: { type: 'ephemeral', ttl: '1h' } },
        ]),
      ).ok,
    ).toBe(false);
  });
});
