/**
 * Where a confirmed entry's audio lives.
 *
 * A transcript loses tone, and tone is what the person actually sounded like.
 * The file is kept until the person deletes it — with its entry, or every
 * recording at once by switching keeping them off. The app no longer deletes
 * a voice on its own after thirteen months (owner's word, 2026-11-18).
 */
export interface IRecordingStore {
  /**
   * Moves a finished take out of the recorder's scratch space and keeps it —
   * quickly, so confirming an entry never waits on it. A raw take is made
   * compact afterwards; an already compact one (from a backup) is kept as is.
   */
  keep(entryId: string, sourceUri: string): Promise<void>;
  /**
   * Turns every recording still kept raw into its compact form (owner's word,
   * 2026-11-18: AAC on the phone, about a sixth of the WAV). Safe to run at
   * any time and more than once; a no-op where the platform cannot compress.
   */
  compact(): Promise<void>;
  /** Silent when there is nothing kept: deleting twice is not an error. */
  discard(entryId: string): Promise<void>;
  /** Removes everything recorded before the cutoff. Entries are untouched. */
  discardBefore(cutoff: Date): Promise<void>;
  /** Null when the entry has no audio. */
  find(entryId: string): Promise<string | null>;
  /** Every entry that still has its audio, in one look rather than one per entry. */
  withAudio(): Promise<ReadonlySet<string>>;
}
