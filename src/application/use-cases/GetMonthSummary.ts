import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';

/** Under this many entries a month has too little in it for prose worth reading. */
const NARRATIVE_FROM_ENTRIES = 3;

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
}

/**
 * The previous month, written back — the weekly narrative's longer breath.
 *
 * It exists only in the first days of a new month, on the home card and at
 * the top of the statistics screen, then rests until the next first. An
 * event, not furniture: the month is worth a moment of looking back, not a
 * permanent fixture beside the fresher week.
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
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
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
