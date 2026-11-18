/** One entry's recording on its way into a backup, or out of one. */
export interface BackupRecording {
  readonly entryId: string;
  readonly uri: string;
}

/** A file the person picked to restore from: where it is, and what it is called. */
export interface PickedFile {
  readonly uri: string;
  readonly name: string;
}

/** What a backup held: the journal, and the recordings that travelled with it. */
export interface OpenedBackup {
  readonly json: string;
  readonly recordings: readonly BackupRecording[];
}

/** The backup file, written: where it is and how many recordings made it in. */
export interface WrittenBackup {
  readonly uri: string;
  readonly recordingCount: number;
}

export interface BackupInput {
  /** The file's name without its extension, which the archive picks. */
  readonly basename: string;
  readonly json: string;
  readonly recordings: readonly BackupRecording[];
  /** Called after each recording is packed, so a long backup can say how far it is. */
  readonly onProgress?: (done: number, total: number) => void;
}

/**
 * The backup as one file with the voice inside (owner's word, 2026-11-18):
 * the journal's JSON and every kept recording, compressed, so a new phone
 * gets back what was said and how it sounded. Where the platform cannot pack
 * audio, the backup is the journal's text alone, as it always was, and an
 * older text-only backup still opens.
 */
export interface IBackupArchive {
  /** False where recordings cannot travel, and the backup is the text alone. */
  readonly carriesAudio: boolean;
  /** Writes the backup file. A recording that cannot be packed is left out, not fatal. */
  write(input: BackupInput): Promise<WrittenBackup>;
  /** Opens a picked backup; its recordings are ready to keep as they are. Throws on a file that is not one. */
  open(file: PickedFile): Promise<OpenedBackup>;
  /** Removes whatever opening left behind. */
  close(): Promise<void>;
}
