import { MoodEntry } from '@/domain/entities/MoodEntry';
import {
  clipsOf,
  GLIMPSE_MS,
  lengthOf,
  MONTH_VOICE_GAP_MS,
  type MonthVoice,
} from '@/domain/entities/MonthVoice';
import { Confidence } from '@/domain/value-objects/Confidence';

function entry(id: string, safetyFlag: 'none' | 'distress' | 'crisis' = 'none'): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(2026, 9, 9, 21, 40),
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'A quiet weekend.',
    mood: null,
    confidence: Confidence.of(0.9),
    safetyFlag,
  });
}

const october: MonthVoice = {
  monthStart: new Date(2026, 9, 1),
  voiced: [
    { entry: entry('short'), uri: 'file:///short.m4a', lengthMs: 6_000 },
    { entry: entry('long'), uri: 'file:///long.m4a', lengthMs: 95_000 },
  ],
};

describe('a month heard in its own voice', () => {
  it('plays the first ten seconds of each take, cutting only the longer ones', () => {
    expect(clipsOf(october, 'glimpse').map(({ fromMs, toMs, cut }) => ({ fromMs, toMs, cut }))).toEqual([
      { fromMs: 0, toMs: 6_000, cut: false },
      { fromMs: 0, toMs: GLIMPSE_MS, cut: true },
    ]);
  });

  it('plays every take in full in the other mode', () => {
    expect(clipsOf(october, 'whole').map(({ toMs, cut }) => ({ toMs, cut }))).toEqual([
      { toMs: 6_000, cut: false },
      { toMs: 95_000, cut: false },
    ]);
  });

  it('counts the quiet between takes in how long the month plays', () => {
    expect(lengthOf(october, 'glimpse')).toBe(6_000 + GLIMPSE_MS + MONTH_VOICE_GAP_MS);
    expect(lengthOf(october, 'whole')).toBe(6_000 + 95_000 + MONTH_VOICE_GAP_MS);
    expect(lengthOf({ ...october, voiced: [] }, 'whole')).toBe(0);
  });
});
