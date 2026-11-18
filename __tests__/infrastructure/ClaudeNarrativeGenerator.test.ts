import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { ClaudeNarrativeGenerator, describeEntries } from '@/infrastructure/analysis/ClaudeNarrativeGenerator';

import { FakeMessagesClient, textReply } from './fakes';

function entry(id: string, day: number, overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(Date.UTC(2026, 9, day, 12, 0)),
    source: 'voice',
    rawTranscript: 'anything',
    cleanTranscript: 'Work again.',
    mood: MoodScore.of(2),
    emotionIds: ['bad.tired'],
    contextTags: ['work'],
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

const MONTH = [entry('a', 3), entry('b', 20, { source: 'text' }), entry('c', 28)];

describe('the month as the model reads it', () => {
  it('puts the voice after the words of each entry that was heard', () => {
    const lines = describeEntries(MONTH, new Map([
      ['a', { marks: [] }],
      ['c', { marks: ['quieter', 'slower'] }],
    ])).split('\n');

    expect(lines[0]).toBe('2026-10-03 | mood 2 | emotions: bad.tired | about: work | "Work again." | voice: as usual');
    expect(lines[1]).not.toContain('voice:');
    expect(lines[2]).toMatch(/"Work again\." \| voice: quieter, slower$/);
  });

  it('reads as it did before the voice when none was heard', () => {
    expect(describeEntries(MONTH)).not.toContain('voice:');
  });

  it('sends the voice with the month and asks for it in the same plain words', async () => {
    const client = new FakeMessagesClient(textReply('A tiring month at work.'));

    await new ClaudeNarrativeGenerator(client).generate(MONTH, new Map([['c', { marks: ['quieter'] }]]));

    const request = client.requests[0];
    const system = typeof request?.system === 'string' ? request.system : '';

    expect(request?.messages[0]?.content).toContain('voice: quieter');
    expect(system).toContain('how they sounded saying it');
    expect(system).toContain('The voice gets one sentence at most');
    expect(system).toContain('never mention pitch, loudness, measuring, the phone or numbers');
    // The month's own rules stay as they were.
    expect(system).toContain('Plain words only, no metaphors');
    expect(system).toContain('never with a past-tense verb whose subject is them');
  });
});
