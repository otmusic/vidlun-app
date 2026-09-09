import { CreateUnheardEntry } from '@/application/use-cases/CreateUnheardEntry';
import { Confidence } from '@/domain/value-objects/Confidence';

import { FixedClock, SequentialIdGenerator } from './fakes';

describe('the draft for words Vidlun could not listen to', () => {
  const clock = new FixedClock(new Date('2026-09-09T18:00:00Z'));

  it('keeps the words as they were heard and proposes nothing', () => {
    const entry = new CreateUnheardEntry(clock, new SequentialIdGenerator()).execute(
      { text: 'a long day, mostly fine', confidence: Confidence.of(0.8) },
      'voice',
    );

    expect(entry.rawTranscript).toBe('a long day, mostly fine');
    expect(entry.cleanTranscript).toBe('a long day, mostly fine');
    expect(entry.source).toBe('voice');
    expect(entry.mood).toBeNull();
    expect(entry.emotionIds).toEqual([]);
    expect(entry.proposedEmotionIds).toEqual([]);
    expect(entry.selfEmotionIds).toEqual([]);
    expect(entry.observation).toBeNull();
    expect(entry.safetyFlag).toBe('none');
    expect(entry.confidence.value).toBe(0.8);
    expect(entry.createdAt).toEqual(new Date('2026-09-09T18:00:00Z'));
  });

  it('belongs to the moment it was spoken when that is given', () => {
    const spokenAt = new Date('2026-09-08T19:30:00Z');
    const entry = new CreateUnheardEntry(clock, new SequentialIdGenerator()).execute(
      { text: 'yesterday was quiet', confidence: Confidence.of(1) },
      'text',
      spokenAt,
    );

    expect(entry.createdAt).toEqual(spokenAt);
    expect(entry.source).toBe('text');
  });
});
