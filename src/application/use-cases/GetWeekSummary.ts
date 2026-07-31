import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';

export interface DailyMood {
  readonly date: Date;
  /** Null on a day with no entry — an untracked day is not a bad day. */
  readonly averageMood: number | null;
  readonly entryCount: number;
}

export interface WeekSummary {
  readonly weekStart: Date;
  /** Exclusive. */
  readonly weekEnd: Date;
  readonly days: readonly DailyMood[];
  readonly entryCount: number;
  /** Null unless the caller asked for it and the week has something to say. */
  readonly narrative: string | null;
}

export interface GetWeekSummaryInput {
  /**
   * Entitlement lives with the caller. The daily trend is never gated: only
   * the AI narrative is paid.
   */
  readonly withNarrative: boolean;
  /** Any day inside the week of interest. Defaults to today. */
  readonly containing?: Date;
}

const DAYS_IN_WEEK = 7;
const MONDAY = 1;

export class GetWeekSummary {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly narrativeGenerator: INarrativeGenerator,
    private readonly clock: IClock,
  ) {}

  async execute(input: GetWeekSummaryInput): Promise<WeekSummary> {
    const weekStart = startOfWeek(input.containing ?? this.clock.now());
    const weekEnd = addDays(weekStart, DAYS_IN_WEEK);
    const entries = await this.repository.findBetween(weekStart, weekEnd);
    const oldestFirst = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      weekStart,
      weekEnd,
      days: buildDays(weekStart, oldestFirst),
      entryCount: oldestFirst.length,
      narrative:
        input.withNarrative && oldestFirst.length > 0
          ? await this.narrativeGenerator.generate(oldestFirst)
          : null,
    };
  }
}

/** Weeks run Monday to Sunday, matching how the insights screen reads. */
function startOfWeek(date: Date): Date {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (midnight.getDay() - MONDAY + DAYS_IN_WEEK) % DAYS_IN_WEEK;

  return addDays(midnight, -daysSinceMonday);
}

function addDays(date: Date, days: number): Date {
  const shifted = new Date(date.getTime());

  shifted.setDate(shifted.getDate() + days);

  return shifted;
}

function buildDays(weekStart: Date, entries: readonly MoodEntry[]): readonly DailyMood[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_unused, offset) => {
    const date = addDays(weekStart, offset);
    const nextDate = addDays(weekStart, offset + 1);
    const onThisDay = entries.filter(
      (entry) => entry.createdAt >= date && entry.createdAt < nextDate,
    );

    return {
      date,
      averageMood: averageMood(onThisDay),
      entryCount: onThisDay.length,
    };
  });
}

function averageMood(entries: readonly MoodEntry[]): number | null {
  if (entries.length === 0) {
    return null;
  }

  const total = entries.reduce((sum, entry) => sum + entry.mood.value, 0);

  return Math.round((total / entries.length) * 10) / 10;
}
