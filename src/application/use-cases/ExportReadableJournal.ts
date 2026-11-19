import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IReadableArchive, ReadableVoice } from '../../domain/ports/IReadableArchive';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import { renderMarkdown, type ExportJournalInput } from './ExportJournal';

export interface ReadableExportInput extends ExportJournalInput {
  /** The folder the export unpacks into, already in the person's language. */
  readonly folderName: string;
  /** The journal's file name inside it, `export.journalFile` in the person's language. */
  readonly journalName: string;
  /** The words of each link to a voice, `export.voice`. */
  readonly voiceLabel: string;
}

export interface ReadableExportOutcome {
  /** Where the export is, ready to hand to the person. */
  readonly uri: string;
  readonly entryCount: number;
  /** Voices that made it into the file. */
  readonly voiceCount: number;
}

/** The voices sit in a folder of their own beside the journal. */
const AUDIO = 'audio';

/**
 * The journal to read, print or take to another app (owner's word,
 * 2026-11-19): free for everyone and every entry in it, a closed one too, so
 * a person without a subscription still holds their own journal in a form
 * they can read. The Markdown is the same `ExportJournal` has always written,
 * and each entry whose voice the phone still has links to it, the file named
 * by when it was said ("2026-11-18 21-10.m4a").
 *
 * The backup is the other way out and stays as it is: an archive for the app
 * to restore from, not for a person to open.
 */
export class ExportReadableJournal {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly recordings: IRecordingStore,
    private readonly archive: IReadableArchive,
  ) {}

  /** Null when the journal is empty: there is nothing to export yet. */
  async execute(
    input: ReadableExportInput,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ReadableExportOutcome | null> {
    const oldestFirst = [...(await this.repository.findAll())].reverse();

    if (oldestFirst.length === 0) {
      return null;
    }

    const voices = this.archive.carriesAudio ? await this.voicesOf(oldestFirst) : [];
    const pathByEntry = new Map(voices.map((voice) => [voice.entryId, `${AUDIO}/${voice.name}`]));

    const written = await this.archive.write({
      folderName: input.folderName,
      journalName: input.journalName,
      voices,
      render: (withVoice) =>
        renderMarkdown(oldestFirst, input, {
          label: input.voiceLabel,
          pathOf: (entryId) => (withVoice.has(entryId) ? (pathByEntry.get(entryId) ?? null) : null),
        }),
      onProgress,
    });

    return { uri: written.uri, entryCount: oldestFirst.length, voiceCount: written.voiceCount };
  }

  private async voicesOf(entries: readonly MoodEntry[]): Promise<readonly ReadableVoice[]> {
    const withAudio = await this.recordings.withAudio();
    const taken = new Set<string>();
    const voices: ReadableVoice[] = [];

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
