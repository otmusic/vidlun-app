import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

/** How often one emotion was on the person's entries in the period. */
export interface EmotionCount {
  readonly id: string;
  /** Entries that held it; an entry counts once however it was named. */
  readonly count: number;
}

export interface VocabularyGrowth {
  /** The period this describes: `from` inclusive, `to` exclusive. */
  readonly from: Date;
  readonly to: Date;
  /**
   * Every emotion on the period's entries, the most frequent first; at the
   * same count, the one named most recently first. Read from `emotionIds`:
   * what the journal holds, the words on its cards. A word that has since left
   * the vocabulary still counts, because the entry still says it.
   */
  readonly counts: readonly EmotionCount[];
}

export interface GetVocabularyGrowthInput {
  /** Inclusive. Defaults to the first of the month `to` ends in. */
  readonly from?: Date;
  /** Exclusive. Defaults to tomorrow, so today's entries are counted. */
  readonly to?: Date;
}

/**
 * "Your emotions": which emotions the person's entries held in a period, and how
 * often (owner's word, 2026-10-13).
 *
 * It used to measure the person's own vocabulary as well — words named for
 * the first time, broad words traded for finer ones, a sentence about a root
 * opening out. The owner took the first-time words off the screen on
 * 2026-10-13, and the rest went with the flat vocabulary of 2026-10-20:
 * without levels there is no broader or finer word to trade between.
 */
export class GetVocabularyGrowth {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: GetVocabularyGrowthInput = {}): Promise<VocabularyGrowth> {
    const to = input.to ?? startOfDay(addDays(this.clock.now(), 1));
    const from = input.from ?? startOfMonth(addDays(to, -1));
    const entries = await this.repository.findAll();

    return {
      from,
      to,
      counts: countsIn(entries.filter((entry) => entry.createdAt >= from && entry.createdAt < to)),
    };
  }
}

function countsIn(entries: readonly MoodEntry[]): readonly EmotionCount[] {
  const counts = new Map<string, number>();
  const newestFirst = [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  for (const entry of newestFirst) {
    for (const id of new Set(entry.emotionIds)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  // A stable sort, so ties keep the newest-first order they were met in.
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const shifted = new Date(date.getTime());

  shifted.setDate(shifted.getDate() + days);

  return shifted;
}
