/**
 * What the app wrote about a month and kept, so that deleting an entry can
 * take back what was written from it. A month's narrative can retell what a
 * deleted entry said; keeping it would keep the entry in other words.
 */
export interface INarrativeMemory {
  /** Forgets what was written about the month `day` falls in. */
  forgetMonthOf(day: Date): Promise<void>;
}
