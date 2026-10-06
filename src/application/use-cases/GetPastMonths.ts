import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import { NARRATIVE_FROM_ENTRIES } from './GetMonthSummary';

export interface PastMonth {
  /** Midnight on the first of the month. */
  readonly monthStart: Date;
  readonly entryCount: number;
}

/**
 * Every month there is something to read about, newest first (owner's word,
 * 2026-10-06). The home card shows the month just ended for a week; this is
 * where it, and every month before it, stays to be read again. Finished
 * months only, and only those with enough in them for the month's piece to
 * be written at all.
 */
export class GetPastMonths {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly clock: IClock,
  ) {}

  async execute(): Promise<readonly PastMonth[]> {
    const now = this.clock.now();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const counts = new Map<number, number>();

    for (const entry of await this.repository.findAll()) {
      const start = new Date(entry.createdAt.getFullYear(), entry.createdAt.getMonth(), 1).getTime();

      if (start < thisMonth) {
        counts.set(start, (counts.get(start) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .filter(([, count]) => count >= NARRATIVE_FROM_ENTRIES)
      .sort(([earlier], [later]) => later - earlier)
      .map(([start, entryCount]) => ({ monthStart: new Date(start), entryCount }));
  }
}
