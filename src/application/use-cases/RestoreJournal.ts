import type { IBackupArchive, PickedFile } from '../../domain/ports/IBackupArchive';
import type { IFilePicker } from '../../domain/ports/IFilePicker';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { ImportJournal, ImportOutcome } from './ImportJournal';

export interface RestoreOutcome extends ImportOutcome {
  /** Recordings that came back and are kept again. */
  readonly recordings: number;
}

/**
 * A backup coming home, with its voice (owner's word, 2026-11-18).
 *
 * The entries merge as they always did — nothing already here is touched.
 * Then each recording in the file goes back to its entry, however old —
 * the app no longer deletes a voice on its own (owner's word, 2026-11-18) —
 * unless the person has turned keeping recordings off, the entry is not
 * here, or it already has its audio. A recording that cannot be read is
 * skipped; the entries are what must come back.
 *
 * The file the person picked is given back to the picker however the
 * restore ends: its copy holds the whole journal and its voice, and must
 * not outlive the reading.
 */
export class RestoreJournal {
  constructor(
    private readonly importJournal: ImportJournal,
    private readonly repository: IMoodEntryRepository,
    private readonly recordings: IRecordingStore,
    private readonly archive: IBackupArchive,
    private readonly picker: IFilePicker,
  ) {}

  /** Null when the person closed the picker without choosing a file. */
  async execute(keepRecordings: boolean): Promise<RestoreOutcome | null> {
    const file = await this.picker.pickFile();

    if (file === null) {
      return null;
    }

    try {
      return await this.restoreFrom(file, keepRecordings);
    } finally {
      await this.picker.discard(file);
    }
  }

  private async restoreFrom(file: PickedFile, keepRecordings: boolean): Promise<RestoreOutcome> {
    try {
      const opened = await this.archive.open(file);
      const outcome = await this.importJournal.execute(opened.json);

      if (!keepRecordings || opened.recordings.length === 0) {
        return { ...outcome, recordings: 0 };
      }

      const alreadyHeard = await this.recordings.withAudio();
      let restored = 0;

      for (const recording of opened.recordings) {
        const entry = alreadyHeard.has(recording.entryId)
          ? null
          : await this.repository.findById(recording.entryId);

        if (entry === null) {
          continue;
        }

        try {
          await this.recordings.keep(recording.entryId, recording.uri);
          restored += 1;
        } catch {
          // One unreadable recording costs that recording, never the restore.
        }
      }

      return { ...outcome, recordings: restored };
    } finally {
      await this.archive.close();
    }
  }
}
