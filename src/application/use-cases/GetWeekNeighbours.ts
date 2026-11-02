import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import { startOfWeek } from './GetWeekSummary';

export interface WeekNeighbours {
  /**
   * How many weeks back the nearest earlier week with an entry is, or null
   * when the journal holds nothing earlier: an arrow into a week from before
   * the journal began reads as a week the person failed to fill.
   */
  readonly earlierWeeksBack: number | null;
  /**
   * How many weeks back the nearest later week with an entry is, or this
   * week (0) when nothing later was written, since this week is always worth
   * showing. Null from this week itself: there is nothing past it yet.
   */
  readonly laterWeeksBack: number | null;
}

export interface GetWeekNeighboursInput {
  /** The week in view, counted back from this one; 0 is this week. */
  readonly weeksBack: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Where the week screen's arrows lead (owner's word, 2026-10-30). They step
 * over the weeks nobody wrote in, to the nearest week that holds something.
 * Before this the back arrow looked only one week back, so a single empty
 * week cut the screen off from every week before it.
 */
export class GetWeekNeighbours {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: GetWeekNeighboursInput): Promise<WeekNeighbours> {
    const thisWeek = startOfWeek(this.clock.now());
    const weekStart = new Date(thisWeek.getTime());

    weekStart.setDate(weekStart.getDate() - input.weeksBack * 7);

    const weekEnd = new Date(weekStart.getTime());

    weekEnd.setDate(weekEnd.getDate() + 7);

    const dates = (await this.repository.findAll()).map((entry) => entry.createdAt.getTime());
    const before = dates.filter((time) => time < weekStart.getTime());
    const after = dates.filter((time) => time >= weekEnd.getTime());
    const weeksBackOf = (time: number): number =>
      // Rounded, because a week that spans a clock change is an hour longer
      // or shorter than seven days.
      Math.max(0, Math.round((thisWeek.getTime() - startOfWeek(new Date(time)).getTime()) / WEEK_MS));

    return {
      earlierWeeksBack: before.length === 0 ? null : weeksBackOf(Math.max(...before)),
      laterWeeksBack:
        input.weeksBack === 0 ? null : after.length === 0 ? 0 : weeksBackOf(Math.min(...after)),
    };
  }
}
