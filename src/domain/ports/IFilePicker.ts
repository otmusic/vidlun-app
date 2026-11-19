import type { PickedFile } from './IBackupArchive';

/**
 * Lets the person choose one file. Null when they closed the picker without
 * choosing — a decision, not an error.
 *
 * What comes back may be a copy made for this app to read, and a backup's
 * copy is the whole journal with its voice, so whoever picks a file gives it
 * back once it has been read.
 */
export interface IFilePicker {
  pickFile(): Promise<PickedFile | null>;
  /**
   * Removes the copy made for this app, if there is one; the person's own
   * file is never touched. Never throws: a copy that will not go must not
   * turn a finished restore into a failed one.
   */
  discard(file: PickedFile): Promise<void>;
}
