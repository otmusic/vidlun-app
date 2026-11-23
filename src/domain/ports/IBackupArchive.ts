/** One entry's recording on its way out of a backup: whose it is, and where the file is now. */
export interface BackupRecording {
  readonly entryId: string;
  readonly uri: string;
}

/** One entry's voice on its way into a backup, under the name it will have there. */
export interface BackupVoice {
  readonly entryId: string;
  /** The file's name in the backup's audio folder, e.g. "2026-11-18 21-10.m4a". */
  readonly name: string;
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
  /** The folder the backup unpacks into, and the file's own name, in the person's language. */
  readonly folderName: string;
  /** The readable journal's file inside it, e.g. "Journal.md" in English. */
  readonly journalName: string;
  /** The whole journal for Vidlun to read back, every field of every entry. */
  readonly json: string;
  readonly voices: readonly BackupVoice[];
  /**
   * The readable journal, asked for once the voices are in, with where each
   * voice that made it sits relative to the journal: a link is written only
   * to a file that is there.
   */
  readonly render: (placed: ReadonlyMap<string, string>) => string;
  /** Called after each voice is packed, so a long backup can say how far it is. */
  readonly onProgress?: (done: number, total: number) => void;
}

/**
 * The backup (owner's word, 2026-11-23): one file that is both the journal
 * to read anywhere, every entry as text with its voice beside it, and the
 * copy Vidlun restores from, which travels inside it unseen. Before, these
 * were two files, a readable export and an archive only the app could open;
 * people could not tell which one to keep.
 *
 * Opening takes that file, and the backups of earlier versions too: the
 * archive with recordings from 1.10 and 1.11, and plain JSON before it.
 * Where the platform cannot pack audio, the backup is the JSON alone.
 */
export interface IBackupArchive {
  /** False where recordings cannot travel, and the backup is the text alone. */
  readonly carriesAudio: boolean;
  /** Writes the backup file. A voice that cannot be packed is left out, and so is its link. */
  write(input: BackupInput): Promise<WrittenBackup>;
  /** Opens a picked backup; its recordings are ready to keep as they are. Throws on a file that is not one. */
  open(file: PickedFile): Promise<OpenedBackup>;
  /** Removes whatever opening left behind. */
  close(): Promise<void>;
}
