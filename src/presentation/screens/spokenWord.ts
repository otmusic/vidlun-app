import type { TextMatch } from '@/domain/value-objects/SearchQuery';

/** A run of the transcript, lit when a search found it or when it is being said. */
export interface TranscriptPiece {
  readonly text: string;
  readonly found: boolean;
  readonly spoken: boolean;
}

/** Letters, digits and the apostrophes inside a word, in any script. */
const WORD = /[\p{L}\p{N}'’ʼ]+/gu;

/**
 * The word `share` of the way through the text (owner's word, 2026-11-24):
 * the one being said, give or take, as the recording plays. A share that
 * lands between words keeps the word before it, as a pause would. Null for
 * text without words.
 */
export function wordAt(text: string, share: number): TextMatch | null {
  const at = Math.min(Math.max(share, 0), 1) * text.length;
  let last: TextMatch | null = null;

  for (const match of text.matchAll(WORD)) {
    const word = { start: match.index, end: match.index + match[0].length };

    if (word.start > at) {
      return last ?? word;
    }

    last = word;
  }

  return last;
}

/** The transcript cut where a found or a spoken word starts and ends, in order. */
export function transcriptPieces(
  text: string,
  found: readonly TextMatch[],
  spoken: TextMatch | null,
): readonly TranscriptPiece[] {
  const marks = spoken === null ? found : [...found, spoken];
  const cuts = [...new Set([0, text.length, ...marks.flatMap((mark) => [mark.start, mark.end])])]
    .filter((cut) => cut >= 0 && cut <= text.length)
    .sort((a, b) => a - b);
  const pieces: TranscriptPiece[] = [];

  for (let at = 0; at < cuts.length - 1; at += 1) {
    const start = cuts[at] ?? 0;
    const end = cuts[at + 1] ?? start;

    if (end <= start) {
      continue;
    }

    const piece = {
      text: text.slice(start, end),
      found: found.some((mark) => mark.start <= start && end <= mark.end),
      spoken: spoken !== null && spoken.start <= start && end <= spoken.end,
    };
    const before = pieces[pieces.length - 1];

    if (before !== undefined && before.found === piece.found && before.spoken === piece.spoken) {
      pieces[pieces.length - 1] = { ...before, text: before.text + piece.text };
    } else {
      pieces.push(piece);
    }
  }

  return pieces;
}
