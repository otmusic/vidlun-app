export interface EntryRevisionRecord {
  readonly entryId: string;
  readonly revisedAt: Date;
  readonly proposedMood: number;
  readonly finalMood: number;
  readonly proposedEmotionIds: readonly string[];
  readonly finalEmotionIds: readonly string[];
}

/**
 * What Luna proposed against what the user kept. Collected from day one
 * because personalization later cannot be back-filled.
 */
export interface IRevisionLog {
  record(revision: EntryRevisionRecord): Promise<void>;
  /**
   * Drops everything held about one entry. The diff is made out of what the
   * person said, so it does not get to outlive the entry they removed —
   * training data is not a reason to keep something they deleted.
   */
  forget(entryId: string): Promise<void>;
}
