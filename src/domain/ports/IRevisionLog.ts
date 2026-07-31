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
}
