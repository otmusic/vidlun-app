import {
  FindSpokenMoment,
  LEAD_IN_MS,
  momentAt,
  shareAt,
  shareBefore,
  startFor,
} from '@/application/use-cases/FindSpokenMoment';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import type { ISpeechTimeline, SpeechSpan } from '@/domain/ports/ISpeechTimeline';
import { Confidence } from '@/domain/value-objects/Confidence';
import { SearchQuery } from '@/domain/value-objects/SearchQuery';

class FakeTimeline implements ISpeechTimeline {
  read = 0;

  constructor(private readonly found: readonly SpeechSpan[] | null) {}

  spans(): Promise<readonly SpeechSpan[] | null> {
    this.read += 1;

    return Promise.resolve(this.found);
  }
}

function entry(raw: string, clean = raw): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: new Date(2026, 10, 20, 21, 0),
    source: 'voice',
    rawTranscript: raw,
    cleanTranscript: clean,
    mood: null,
    confidence: Confidence.of(0.9),
    emotionIds: [],
  });
}

function query(typed: string): SearchQuery {
  const parsed = SearchQuery.of(typed);

  if (parsed === null) {
    throw new Error('nothing to search');
  }

  return parsed;
}

describe('FindSpokenMoment', () => {
  it('lays the word over the speech, skipping the pauses', () => {
    // Two seconds of speech, a long pause, two more: halfway through the speech is the second stretch's start.
    const spans = [
      { fromMs: 1_000, toMs: 3_000 },
      { fromMs: 10_000, toMs: 12_000 },
    ];

    expect(momentAt(0, spans)).toBe(1_000);
    expect(momentAt(0.25, spans)).toBe(2_000);
    expect(momentAt(0.5, spans)).toBe(3_000);
    expect(momentAt(0.75, spans)).toBe(11_000);
    expect(momentAt(1, spans)).toBe(12_000);
  });

  it('places the word by the raw transcript, which follows the speech word for word', () => {
    const raw = 'um so the walk was nice and then a meeting';
    const said = entry(raw, 'The walk was nice, then a meeting.');

    expect(shareBefore(said, query('meeting'))).toBe(raw.indexOf('meeting') / raw.length);
  });

  it('falls back to the cleaned text when the word is only there after cleaning', () => {
    const said = entry('the meating ran late', 'The meeting ran late.');

    expect(shareBefore(said, query('meeting'))).toBe(4 / 21);
  });

  it('has no place for a word the entry does not hold', () => {
    expect(shareBefore(entry('a quiet evening'), query('meeting'))).toBeNull();
  });

  it('starts the player a little before the word, never before the start', async () => {
    const timeline = new FakeTimeline([{ fromMs: 0, toMs: 20_000 }]);
    const subject = new FindSpokenMoment(timeline);

    const late = await subject.execute(entry('aaaaaaaaaa meeting'), 'file:///take.m4a', query('meeting'));
    const early = await subject.execute(entry('meeting at nine'), 'file:///take.m4a', query('meeting'));

    expect(late).toBeCloseTo((11 / 18) * 20_000 - LEAD_IN_MS);
    expect(early).toBe(0);
  });

  it('says nothing when the recording cannot be read', async () => {
    expect(
      await new FindSpokenMoment(new FakeTimeline(null)).execute(entry('a meeting'), 'file:///x.m4a', query('meeting')),
    ).toBeNull();
    expect(
      await new FindSpokenMoment(new FakeTimeline([])).execute(entry('a meeting'), 'file:///x.m4a', query('meeting')),
    ).toBeNull();
  });

  it('does not read the recording for a word the entry does not hold', async () => {
    const timeline = new FakeTimeline([{ fromMs: 0, toMs: 1_000 }]);

    expect(await new FindSpokenMoment(timeline).execute(entry('a walk'), 'file:///x.m4a', query('meeting'))).toBeNull();
    expect(timeline.read).toBe(0);
  });
});

describe('following the words as the recording plays', () => {
  const spans: readonly SpeechSpan[] = [
    { fromMs: 1_000, toMs: 5_000 },
    { fromMs: 7_000, toMs: 11_000 },
  ];

  it('is the share of the speech already heard', () => {
    expect(shareAt(3_000, spans)).toBeCloseTo(0.25);
    expect(shareAt(9_000, spans)).toBeCloseTo(0.75);
  });

  it('holds still through a pause', () => {
    expect(shareAt(5_000, spans)).toBeCloseTo(0.5);
    expect(shareAt(6_500, spans)).toBeCloseTo(0.5);
  });

  it('is nothing before the first word and all of it after the last', () => {
    expect(shareAt(0, spans)).toBe(0);
    expect(shareAt(20_000, spans)).toBe(1);
  });

  it('goes back the way the search goes there', () => {
    expect(shareAt(momentAt(0.4, spans), spans)).toBeCloseTo(0.4);
  });

  it('is nothing for a recording with no speech', () => {
    expect(shareAt(3_000, [])).toBe(0);
  });
});

describe('reading where the speech is', () => {
  it('reads the spans once for a recording with speech', async () => {
    const timeline = new FakeTimeline([{ fromMs: 0, toMs: 1_000 }]);

    await expect(new FindSpokenMoment(timeline).speechIn('file:///take.m4a')).resolves.toEqual([
      { fromMs: 0, toMs: 1_000 },
    ]);
    expect(timeline.read).toBe(1);
  });

  it('is nothing for a recording without speech or one that cannot be read', async () => {
    await expect(new FindSpokenMoment(new FakeTimeline([])).speechIn('file:///take.m4a')).resolves.toBeNull();
    await expect(new FindSpokenMoment(new FakeTimeline(null)).speechIn('file:///take.m4a')).resolves.toBeNull();
  });

  it('starts a little before a searched word, from spans already read', () => {
    const said = entry('one two three four');

    expect(startFor(said, [{ fromMs: 0, toMs: 10_000 }], query('three'))).toBe(
      Math.max(0, momentAt(8 / 18, [{ fromMs: 0, toMs: 10_000 }]) - LEAD_IN_MS),
    );
    expect(startFor(said, [{ fromMs: 0, toMs: 10_000 }], query('five'))).toBeNull();
  });
});
