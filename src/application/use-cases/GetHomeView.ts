import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { DailyMood } from './GetWeekSummary';

export interface HomeView {
  /** Newest first. */
  readonly recentEntries: readonly MoodEntry[];
  readonly streakDays: number;
  /**
   * The last seven days ending today, oldest first — a rolling window rather
   * than a calendar week, because the strip is about the run a person is on
   * and a Monday would reset it to almost nothing every seven days.
   */
  readonly week: readonly DailyMood[];
}

/** A streak longer than this stops being a number anyone reads. */
const STREAK_WINDOW_DAYS = 365;

const WEEK_DAYS = 7;

export class GetHomeView {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly clock: IClock,
  ) {}

  async execute(recentLimit: number): Promise<HomeView> {
    const today = startOfDay(this.clock.now());
    const [recentEntries, window] = await Promise.all([
      this.repository.findRecent(recentLimit),
      this.repository.findBetween(addDays(today, -STREAK_WINDOW_DAYS), addDays(today, 1)),
    ]);

    return {
      recentEntries,
      streakDays: countStreak(window, today),
      week: buildWeek(window, today),
    };
  }
}

/**
 * Oldest first, so the strip reads left to right into today. A day with no
 * entry carries a null mood rather than a zero: an untracked day is not a bad
 * day, and the difference has to survive all the way to the screen.
 */
function buildWeek(entries: readonly MoodEntry[], today: Date): readonly DailyMood[] {
  return Array.from({ length: WEEK_DAYS }, (_unused, offset) => {
    const date = addDays(today, offset - (WEEK_DAYS - 1));
    const onThisDay = entries.filter((entry) => dayKey(entry.createdAt) === dayKey(date));

    return {
      date,
      topEmotionId: topEmotion(onThisDay),
      averageMood: averageMood(onThisDay),
      entryCount: onThisDay.length,
    };
  });
}

/** The most-named emotion of the day; the later entry wins a tie. */
function topEmotion(entries: readonly MoodEntry[]): string | null {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const id of entry.emotionIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 0;

  for (const [id, count] of counts) {
    if (count >= bestCount) {
      best = id;
      bestCount = count;
    }
  }

  return best;
}

/** Over the entries that said how the day was; null when none of them did. */
function averageMood(entries: readonly MoodEntry[]): number | null {
  const scored = entries.filter((entry) => entry.mood !== null);

  if (scored.length === 0) {
    return null;
  }

  const total = scored.reduce((sum, entry) => sum + (entry.mood?.value ?? 0), 0);

  return Math.round((total / scored.length) * 10) / 10;
}

/**
 * Consecutive days ending today or yesterday. Yesterday still counts so the
 * streak does not appear broken all morning before the day's entry exists —
 * losing it to a clock rather than to a missed day would be a lie.
 */
function countStreak(entries: readonly MoodEntry[], today: Date): number {
  const days = new Set(entries.map((entry) => dayKey(entry.createdAt)));
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1);

  if (!days.has(dayKey(cursor))) {
    return 0;
  }

  let streak = 0;

  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const shifted = new Date(date.getTime());

  shifted.setDate(shifted.getDate() + days);

  return shifted;
}
