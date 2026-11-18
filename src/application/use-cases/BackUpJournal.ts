import type { BackupRecording, IBackupArchive } from '../../domain/ports/IBackupArchive';
import type { IClock } from '../../domain/ports/IClock';
import type { IJournalCodec } from '../../domain/ports/IJournalCodec';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

export interface BackupOutcome {
  /** Where the backup file is, ready to hand to the person. */
  readonly uri: string;
  readonly entryCount: number;
  /** Recordings that made it into the file. */
  readonly recordingCount: number;
}

/**
 * The whole journal as one file the person keeps — and, by the owner's word
 * on 2026-11-18, every recording still on the phone with it, by default. A
 * new phone then gets back how each entry sounded, not only what it said,
 * which is what a voice journal is for.
 *
 * The JSON inside is the same codec the text-only backup always used, so an
 * import loses nothing; the archive decides how the recordings travel, and
 * where it cannot carry them the file is the text alone.
 */
export class BackUpJournal {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly codec: IJournalCodec,
    private readonly recordings: IRecordingStore,
    private readonly archive: IBackupArchive,
    private readonly clock: IClock,
  ) {}

  /** Null when the journal is empty: there is nothing to keep yet. */
  async execute(
    onProgress?: (done: number, total: number) => void,
  ): Promise<BackupOutcome | null> {
    const oldestFirst = [...(await this.repository.findAll())].reverse();

    if (oldestFirst.length === 0) {
      return null;
    }

    const now = this.clock.now();
    const withAudio = this.archive.carriesAudio ? await this.recordings.withAudio() : new Set<string>();
    const recordings: BackupRecording[] = [];

    for (const entry of oldestFirst) {
      const uri = withAudio.has(entry.id) ? await this.recordings.find(entry.id) : null;

      if (uri !== null) {
        recordings.push({ entryId: entry.id, uri });
      }
    }

    const written = await this.archive.write({
      basename: `vidlun-backup-${now.toISOString().slice(0, 10)}`,
      json: this.codec.encode(oldestFirst, now),
      recordings,
      onProgress,
    });

    return {
      uri: written.uri,
      entryCount: oldestFirst.length,
      recordingCount: written.recordingCount,
    };
  }
}
