import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';

/** Under this many entries a month has too little in it for prose worth reading. */
export const NARRATIVE_FROM_ENTRIES = 3;

/** The card and the panel appear this many days into the new month, then rest. */
const FRESH_DAYS = 7;

export interface MonthSummary {
  /** Midnight on the first of the month being written about. */
  readonly monthStart: Date;
  readonly entryCount: number;
  /** Null when not asked for, when too thin, or while it is being written. */
  readonly narrative: string | null;
  /** True when there is enough to write about at all. */
  readonly hasEnough: boolean;
}

export interface GetMonthSummaryInput {
  /** False fetches the shape without paying for the prose. */
  readonly withNarrative: boolean;
  /**
   * Any day of the month to read, for one opened from the list of past
   * months (owner's word, 2026-10-06). Left out, the month just ended.
   */
  readonly month?: Date;
}

/**
 * The previous month, written back — the only narrative since 2026-10-01,
 * when the weekly one went (owner's word).
 *
 * It surfaces in the first days of a new month, as the home card and the
 * page behind it, then rests until the next first. An event, not furniture:
 * the month is worth a moment of looking back, not a permanent fixture.
 * Every past month can still be read from the statistics screen's list.
 */
export class GetMonthSummary {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly narrativeGenerator: INarrativeGenerator,
    private readonly clock: IClock,
  ) {}

  /** True while the previous month's piece is worth surfacing. */
  isFresh(): boolean {
    return this.clock.now().getDate() <= FRESH_DAYS;
  }

  async execute(input: GetMonthSummaryInput): Promise<MonthSummary> {
    const now = this.clock.now();
    const anchor = input.month ?? new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    const entries = await this.repository.findBetween(monthStart, monthEnd);
    const oldestFirst = [...entries].reverse();
    const hasEnough = oldestFirst.length >= NARRATIVE_FROM_ENTRIES;

    return {
      monthStart,
      entryCount: oldestFirst.length,
      hasEnough,
      narrative:
        input.withNarrative && hasEnough
          ? await this.narrativeGenerator.generate(oldestFirst)
          : null,
    };
  }
}

export type { MoodEntry };
