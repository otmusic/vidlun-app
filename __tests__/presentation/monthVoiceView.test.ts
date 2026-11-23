import type { MonthVoicePart } from '@/application/use-cases/ComposeMonthVoice';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import {
  lengthWords,
  monthSpanWords,
  nextStart,
  partAt,
  playedOf,
  previousStart,
} from '@/presentation/screens/monthVoiceView';

function part(id: string, startMs: number, endMs: number): MonthVoicePart {
  return {
    entry: MoodEntry.create({
      id,
      createdAt: new Date(2026, 9, 9),
      source: 'voice',
      rawTranscript: 'raw',
      cleanTranscript: 'Said.',
      mood: null,
      confidence: Confidence.of(0.9),
    }),
    startMs,
    endMs,
  };
}

const parts = [part('a', 0, 10_000), part('b', 10_700, 20_700), part('c', 21_400, 25_000)];

describe('the month voice player', () => {
  it('knows which take is playing, the quiet after one still being that one', () => {
    expect(partAt(parts, 0)).toBe(0);
    expect(partAt(parts, 10_300)).toBe(0);
    expect(partAt(parts, 10_700)).toBe(1);
    expect(partAt(parts, 24_000)).toBe(2);
  });

  it('goes back to the start of a take, or to the one before when it has just begun', () => {
    expect(previousStart(parts, 15_000)).toBe(10_700);
    expect(previousStart(parts, 11_000)).toBe(0);
    expect(previousStart(parts, 500)).toBe(0);
  });

  it('goes on to the next take, and nowhere from the last', () => {
    expect(nextStart(parts, 3_000)).toBe(10_700);
    expect(nextStart(parts, 22_000)).toBeNull();
  });

  it('fills the playing take as it goes', () => {
    expect(playedOf(parts[1]!, 15_700)).toBeCloseTo(0.5);
    expect(playedOf(parts[1]!, 9_000)).toBe(0);
    expect(playedOf(parts[1]!, 30_000)).toBe(1);
  });

  it('says how long in whole minutes, or in seconds under one', () => {
    expect(lengthWords(185_000)).toEqual({ unit: 'minutes', n: 3 });
    expect(lengthWords(42_400)).toEqual({ unit: 'seconds', n: 42 });
    expect(lengthWords(61_000)).toEqual({ unit: 'minutes', n: 1 });
  });

  it('names the month from its first day to its last', () => {
    expect(monthSpanWords(new Date(2026, 9, 1), 'en')).toEqual({ first: 'October 1', last: '31' });
    expect(monthSpanWords(new Date(2026, 1, 1), 'uk').first).toBe('1');
    expect(monthSpanWords(new Date(2026, 1, 1), 'uk').last).toMatch(/^28 /);
  });
});
