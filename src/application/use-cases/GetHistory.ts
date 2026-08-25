import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

export interface HistoryDay {
  /** Local midnight, so the screen never has to work out where a day begins. */
  readonly day: Date;
  /** Newest first, like the days themselves. */
  readonly entries: readonly MoodEntry[];
}

/**
 * The whole journal, in days.
 *
 * Grouped here rather than in the screen because "which day does this belong
 * to" is a real question — it depends on local midnight, the same boundary the
 * streak counts against — and because a use case can be tested in plain Node
 * while a component cannot.
 */
export class GetHistory {
  constructor(private readonly repository: IMoodEntryRepository) {}

  async execute(): Promise<readonly HistoryDay[]> {
    const days: HistoryDay[] = [];

    for (const entry of await this.repository.findAll()) {
      const day = startOfDay(entry.createdAt);
      const open = days[days.length - 1];

      if (open !== undefined && open.day.getTime() === day.getTime()) {
        days[days.length - 1] = { day, entries: [...open.entries, entry] };
        continue;
      }

      days.push({ day, entries: [entry] });
    }

    return days;
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
