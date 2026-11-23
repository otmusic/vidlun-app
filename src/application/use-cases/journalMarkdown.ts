import type { MoodEntry } from '../../domain/entities/MoodEntry';

/** How the readable journal names and dates things, in the person's own language. */
export interface MarkdownLabels {
  /** Turns an emotion id into the word the person knows it by. */
  readonly labelOf: (id: string) => string;
  /** Formats a day heading in the person's own locale. */
  readonly dayOf: (date: Date) => string;
  /** Formats a clock time in the person's own locale. */
  readonly timeOf: (date: Date) => string;
}

/** Where each entry's voice sits beside the journal, for the links to it. */
export interface VoiceLinks {
  /** The link's words, `export.voice` in the person's language. */
  readonly label: string;
  /** The voice file's path relative to the journal, or null when it has none there. */
  readonly pathOf: (entryId: string) => string | null;
}

/**
 * The journal as Markdown, oldest first. With `voices`, an entry whose voice
 * travels with it gets a link to the file between its time and its words
 * (owner's word, 2026-11-19: above the text, so the voice is met first).
 */
export function renderMarkdown(
  entries: readonly MoodEntry[],
  input: MarkdownLabels,
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
