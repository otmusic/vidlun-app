/**
 * Where a confirmed entry's audio lives.
 *
 * A transcript loses tone, and tone is what the person actually sounded like.
 * The file is kept for a year and then removed while the entry stays whole —
 * see §1 of the brief.
 */
export interface IRecordingStore {
  /** Moves a finished take out of the recorder's scratch space and keeps it. */
  keep(entryId: string, sourceUri: string): Promise<void>;
  /** Silent when there is nothing kept: deleting twice is not an error. */
  discard(entryId: string): Promise<void>;
  /** Removes everything recorded before the cutoff. Entries are untouched. */
  discardBefore(cutoff: Date): Promise<void>;
  /** Null when the entry has no audio, or when its year has passed. */
  find(entryId: string): Promise<string | null>;
}
