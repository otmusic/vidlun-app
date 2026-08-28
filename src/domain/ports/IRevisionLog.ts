export interface EntryRevisionRecord {
  readonly entryId: string;
  readonly revisedAt: Date;
  /** Null where the entry never said how the day was. */
  readonly proposedMood: number | null;
  readonly finalMood: number | null;
  readonly proposedEmotionIds: readonly string[];
  readonly finalEmotionIds: readonly string[];
}

/**
 * Someone who read Vidlun's words and kept their own anyway.
 *
 * Deliberately not a field on `EntryRevisionRecord`. A revision is a
 * correction — the entry was wrong and the person fixed it. This is the
 * opposite claim: the entry was Vidlun's reading and the person rejected it
 * whole. §M6 says the two are either model errors or self-knowledge and both
 * are valuable, which is only true while they can still be told apart.
 */
export interface DisagreementRecord {
  readonly entryId: string;
  readonly at: Date;
  /** What Vidlun offered and they declined. */
  readonly proposedEmotionIds: readonly string[];
  /** What they named for themselves, which may be nothing. */
  readonly selfEmotionIds: readonly string[];
}

/**
 * What Vidlun proposed against what the user kept. Collected from day one
 * because personalization later cannot be back-filled.
 */
export interface IRevisionLog {
  record(revision: EntryRevisionRecord): Promise<void>;
  disagree(disagreement: DisagreementRecord): Promise<void>;
  /**
   * Drops everything held about one entry, revisions and disagreements alike. The diff is made out of what the
   * person said, so it does not get to outlive the entry they removed —
   * training data is not a reason to keep something they deleted.
   */
  forget(entryId: string): Promise<void>;
}
