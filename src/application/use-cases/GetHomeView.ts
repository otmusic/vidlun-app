import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

export interface HomeView {
  /** Newest first. */
  readonly recentEntries: readonly MoodEntry[];
  readonly streakDays: number;
}

/** A streak longer than this stops being a number anyone reads. */
const STREAK_WINDOW_DAYS = 365;

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

    return { recentEntries, streakDays: countStreak(window, today) };
  }
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
