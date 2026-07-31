import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import {
  BlankEntryIdError,
  EmptyTranscriptError,
  TooManyEmotionsError,
} from '@/domain/errors/MoodEntryErrors';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';

const CREATED_AT = new Date('2026-07-31T18:00:00.000Z');

function entry(overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: CREATED_AT,
    source: 'voice',
    rawTranscript: 'finished three tasks happy but very tired',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud', 'bad.tired'],
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

describe('MoodEntry invariants', () => {
  it('refuses a blank id', () => {
    expect(() => entry({ id: '   ' })).toThrow(BlankEntryIdError);
  });

  it('refuses an entry with nothing said in it', () => {
    expect(() => entry({ cleanTranscript: '  \n ' })).toThrow(EmptyTranscriptError);
  });

  it('refuses a fifth emotion, which would turn the card into a form', () => {
    expect(() => entry({ emotionIds: ['a', 'b', 'c', 'd', 'e'] })).toThrow(TooManyEmotionsError);
    expect(MoodEntry.MAX_EMOTIONS).toBe(4);
  });

  it('counts a repeated emotion once', () => {
    expect(entry({ emotionIds: ['a', 'b', 'c', 'd', 'a'] }).emotionIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('treats no emotions as a complete entry, not an unfinished one', () => {
    const mundane = entry({ emotionIds: [], cleanTranscript: 'Cooked dinner.' });

    expect(mundane.emotionIds).toEqual([]);
    expect(mundane.hasEmotions).toBe(false);
  });

  it('needs only a transcript, a mood and a confidence to exist', () => {
    const bare = MoodEntry.create({
      id: 'entry-2',
      createdAt: CREATED_AT,
      source: 'text',
      rawTranscript: 'Cooked dinner.',
      cleanTranscript: 'Cooked dinner.',
      mood: MoodScore.of(3),
      confidence: Confidence.of(1),
    });

    expect(bare.emotionIds).toEqual([]);
    expect(bare.contextTags).toEqual([]);
    expect(bare.observation).toBeNull();
    expect(bare.safetyFlag).toBe('none');
    expect(bare.wasRevisedByUser).toBe(false);
  });

  it('tidies context tags and drops the empty ones', () => {
    expect(entry({ contextTags: [' work ', 'work', '', '   ', 'late'] }).contextTags).toEqual([
      'work',
      'late',
    ]);
  });

  it('lets mood and emotions disagree, because tiredness after achievement is a good day', () => {
    const good = entry({ mood: MoodScore.of(4), emotionIds: ['bad.tired'] });

    expect(good.mood.value).toBe(4);
    expect(good.emotionIds).toEqual(['bad.tired']);
  });
});

describe('safety', () => {
  it('drops the observation on a crisis entry', () => {
    const crisis = entry({ safetyFlag: 'crisis', observation: 'What a productive day!' });

    expect(crisis.observation).toBeNull();
  });

  it('keeps the observation when the entry is merely hard', () => {
    const distress = entry({ safetyFlag: 'distress', observation: 'That sounds heavy.' });

    expect(distress.observation).toBe('That sounds heavy.');
  });

  it('still refuses an observation after an entry is flagged later', () => {
    expect(entry({ observation: 'Nice work.' }).withSafetyFlag('crisis').observation).toBeNull();
  });

  it('defaults to no flag and no observation', () => {
    const plain = entry();

    expect(plain.safetyFlag).toBe('none');
    expect(plain.observation).toBeNull();
  });

  it('asks for a look when it barely heard the recording', () => {
    expect(entry({ confidence: Confidence.of(0.2) }).needsUserReview).toBe(true);
    expect(entry().needsUserReview).toBe(false);
  });
});

describe('immutability', () => {
  it('returns a new entry instead of mutating the original', () => {
    const original = entry();
    const changed = original.withMood(MoodScore.of(2));

    expect(changed).not.toBe(original);
    expect(original.mood.value).toBe(4);
    expect(changed.mood.value).toBe(2);
  });

  it('freezes the collections it exposes', () => {
    const subject = entry({ contextTags: ['work'] });

    expect(Object.isFrozen(subject.emotionIds)).toBe(true);
    expect(Object.isFrozen(subject.contextTags)).toBe(true);
  });

  it('does not let the caller move the entry through the date it passed in', () => {
    const createdAt = new Date(CREATED_AT.getTime());
    const subject = entry({ createdAt });

    createdAt.setFullYear(1999);

    expect(subject.createdAt.getTime()).toBe(CREATED_AT.getTime());
  });

  it('copies every field through a change', () => {
    const changed = entry({ contextTags: ['work'] }).withEmotionIds(['sad']);

    expect(changed.id).toBe('entry-1');
    expect(changed.source).toBe('voice');
    expect(changed.rawTranscript).toBe('finished three tasks happy but very tired');
    expect(changed.contextTags).toEqual(['work']);
    expect(changed.emotionIds).toEqual(['sad']);
  });

  it('offers a change for each field the reflection card shows', () => {
    const subject = entry();

    expect(subject.withContextTags(['work']).contextTags).toEqual(['work']);
    expect(subject.withObservation('Noted.').observation).toBe('Noted.');
    expect(subject.withSafetyFlag('distress').safetyFlag).toBe('distress');
  });

  it('round-trips through its own props', () => {
    const subject = entry({ contextTags: ['work'], observation: 'Noted.' });

    expect(MoodEntry.create(subject.toProps()).toProps()).toEqual(subject.toProps());
  });
});

describe('user revisions', () => {
  it('marks an entry the user corrected, so the diff stays visible later', () => {
    const proposed = entry();
    const kept = proposed.reviseWith({ emotionIds: ['happy.proud'], mood: MoodScore.of(5) });

    expect(proposed.wasRevisedByUser).toBe(false);
    expect(kept.wasRevisedByUser).toBe(true);
    expect(kept.emotionIds).toEqual(['happy.proud']);
    expect(kept.mood.value).toBe(5);
  });

  it('lets the user correct the transcript and the tags too', () => {
    const kept = entry().reviseWith({ cleanTranscript: 'Finished three tasks.', contextTags: ['work'] });

    expect(kept.cleanTranscript).toBe('Finished three tasks.');
    expect(kept.contextTags).toEqual(['work']);
  });

  it('does not silently un-revise an entry on a later adjustment', () => {
    expect(entry().reviseWith({ mood: MoodScore.of(3) }).withObservation(null).wasRevisedByUser).toBe(true);
  });

  it('still enforces the emotion limit on a revision', () => {
    expect(() => entry().reviseWith({ emotionIds: ['a', 'b', 'c', 'd', 'e'] })).toThrow(
      TooManyEmotionsError,
    );
  });
});
