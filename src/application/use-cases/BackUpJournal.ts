import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { BackupVoice, IBackupArchive } from '../../domain/ports/IBackupArchive';
import type { IClock } from '../../domain/ports/IClock';
import type { IJournalCodec } from '../../domain/ports/IJournalCodec';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import { renderMarkdown, type MarkdownLabels } from './journalMarkdown';

export interface BackupLabels extends MarkdownLabels {
  /** The folder the backup unpacks into, already in the person's language. */
  readonly folderName: string;
  /** The readable journal's file name inside it, `export.journalFile` in the person's language. */
  readonly journalName: string;
  /** The words of each link to a voice, `export.voice`. */
  readonly voiceLabel: string;
}

export interface BackupOutcome {
  /** Where the backup file is, ready to hand to the person. */
  readonly uri: string;
  readonly entryCount: number;
  /** Recordings that made it into the file. */
  readonly recordingCount: number;
}

/**
 * The whole journal as one file the person keeps (owner's word, 2026-11-23):
 * every entry as Markdown to read anywhere, every voice the phone still has
 * beside it, named by when it was said ("2026-11-18 21-10.m4a"), and the
 * journal whole for Vidlun to restore from. Two files were one too many: the
 * readable export and the backup looked alike, and only one could come back.
 *
 * Free for everyone and every entry in it, a closed one too, as both were:
 * a person without a subscription still holds their own journal. The JSON
 * is the same codec the backup always carried, so a restore loses nothing.
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
    labels: BackupLabels,
    onProgress?: (done: number, total: number) => void,
  ): Promise<BackupOutcome | null> {
    const oldestFirst = [...(await this.repository.findAll())].reverse();

    if (oldestFirst.length === 0) {
      return null;
    }

    const voices = this.archive.carriesAudio ? await this.voicesOf(oldestFirst) : [];
    const written = await this.archive.write({
      folderName: labels.folderName,
      journalName: labels.journalName,
      json: this.codec.encode(oldestFirst, this.clock.now()),
      voices,
      render: (placed) =>
        renderMarkdown(oldestFirst, labels, {
          label: labels.voiceLabel,
          pathOf: (entryId) => placed.get(entryId) ?? null,
        }),
      onProgress,
    });

    return {
      uri: written.uri,
      entryCount: oldestFirst.length,
      recordingCount: written.recordingCount,
    };
  }

  private async voicesOf(entries: readonly MoodEntry[]): Promise<readonly BackupVoice[]> {
    const withAudio = await this.recordings.withAudio();
    const taken = new Set<string>();
    const voices: BackupVoice[] = [];

    for (const entry of entries) {
      const uri = withAudio.has(entry.id) ? await this.recordings.find(entry.id) : null;

      if (uri !== null) {
        const name = uniqueName(voiceStem(entry.createdAt), taken);

        taken.add(name);
        voices.push({ entryId: entry.id, name, uri });
      }
    }

    return voices;
  }
}

/** When the entry was said, on the phone's clock: "2026-11-18 21-10". */
export function voiceStem(date: Date): string {
  const two = (value: number): string => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}-${two(date.getMinutes())}`;
}

/** Two entries in the same minute keep apart: "… 21-10.m4a", then "… 21-10 (2).m4a". */
function uniqueName(stem: string, taken: ReadonlySet<string>): string {
  let name = `${stem}.m4a`;

  for (let copy = 2; taken.has(name); copy += 1) {
    name = `${stem} (${String(copy)}).m4a`;
  }

  return name;
}
