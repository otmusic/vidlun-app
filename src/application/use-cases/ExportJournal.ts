import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IJournalCodec } from '../../domain/ports/IJournalCodec';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

export interface JournalExport {
  /** For people: one readable file, oldest day first. */
  readonly markdown: string;
  /** For machines: everything, byte-faithful to what the phone stores. */
  readonly json: string;
  readonly entryCount: number;
}

export interface ExportJournalInput {
  /** Turns an emotion id into the word the person knows it by. */
  readonly labelOf: (id: string) => string;
  /** Formats a day heading in the person's own locale. */
  readonly dayOf: (date: Date) => string;
  /** Formats a clock time in the person's own locale. */
  readonly timeOf: (date: Date) => string;
}

/** Where each entry's voice sits beside the journal, for the readable export's links. */
export interface VoiceLinks {
  /** The link's words, `export.voice` in the person's language. */
  readonly label: string;
  /** The voice file's path relative to the journal, or null when it has none there. */
  readonly pathOf: (entryId: string) => string | null;
}

/**
 * The whole journal as two files the person owns.
 *
 * The paywall promises backup among the free-forever things, and until this
 * existed the promise was empty: deleting the app deleted the only copy of a
 * year of someone's own words. The JSON half is the backup — it round-trips
 * through the same mapper the repository uses, so an import loses nothing.
 * The markdown half is for reading, printing, or leaving to another app.
 *
 * Audio is not here: the backup the person keeps is `BackUpJournal`, which
 * packs this same JSON together with the recordings (owner's word,
 * 2026-11-18). This file is now the readable half and the JSON both shapes
 * share.
 */
export class ExportJournal {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly codec: IJournalCodec,
    private readonly clock: IClock,
  ) {}

  async execute(input: ExportJournalInput): Promise<JournalExport> {
    const newestFirst = await this.repository.findAll();
    const oldestFirst = [...newestFirst].reverse();

    return {
      markdown: renderMarkdown(oldestFirst, input),
      json: this.codec.encode(oldestFirst, this.clock.now()),
      entryCount: oldestFirst.length,
    };
  }
}

/**
 * The journal as Markdown, oldest first. With `voices`, an entry whose voice
 * travels with it gets a link to the file between its time and its words
 * (owner's word, 2026-11-19: above the text, so the voice is met first).
 */
export function renderMarkdown(
  entries: readonly MoodEntry[],
  input: ExportJournalInput,
  voices?: VoiceLinks,
): string {
  const lines: string[] = ['# Vidlun', ''];
  let day = '';

  for (const entry of entries) {
    const entryDay = input.dayOf(entry.createdAt);

    if (entryDay !== day) {
      day = entryDay;
      lines.push(`## ${entryDay}`, '');
    }

    lines.push(`**${input.timeOf(entry.createdAt)}**`, '');

    const voice = voices?.pathOf(entry.id) ?? null;

    if (voices !== undefined && voice !== null) {
      // Spaces and the like escaped, so every Markdown reader follows the link.
      lines.push(`[${voices.label}](${encodeURI(voice)})`, '');
    }

    lines.push(entry.cleanTranscript, '');

    if (entry.emotionIds.length > 0) {
      lines.push(`*${entry.emotionIds.map((id) => input.labelOf(id)).join(' · ')}*`, '');
    }

    if (entry.observation !== null) {
      lines.push(`> ${entry.observation}`, '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
