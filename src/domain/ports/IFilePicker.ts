import type { PickedFile } from './IBackupArchive';

/**
 * Lets the person choose one file. Null when they closed the picker without
 * choosing — a decision, not an error.
 */
export interface IFilePicker {
  pickFile(): Promise<PickedFile | null>;
}
