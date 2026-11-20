import type { SearchQuery, TextMatch } from '@/domain/value-objects/SearchQuery';

/** A run of text, lit when it is a found word. */
export interface Piece {
  readonly text: string;
  readonly found: boolean;
}

/** Where the snippet starts when the found word sits deep in a long sentence. */
const LEAD = 32;
/** How deep into its sentence a word may sit before the snippet stops starting there. */
const REACH = 64;
const ELLIPSIS = '…';

/** The text cut into plain and found pieces, in order, for drawing the found ones lit. */
export function piecesOf(text: string, marks: readonly TextMatch[]): readonly Piece[] {
  const pieces: Piece[] = [];
  let at = 0;

  for (const mark of marks) {
    if (mark.start < at) {
      continue;
    }

    if (mark.start > at) {
      pieces.push({ text: text.slice(at, mark.start), found: false });
    }

    pieces.push({ text: text.slice(mark.start, mark.end), found: true });
    at = mark.end;
  }

  if (at < text.length) {
    pieces.push({ text: text.slice(at), found: false });
  }

  return pieces;
}

/**
 * What a search result shows of an entry (owner's word, 2026-11-20, the
 * canvas's search page): the sentence the first found word is in, rather
 * than the entry's opening, with every found word lit. A word deep in a long
 * sentence brings the snippet to a few words before it, behind an ellipsis.
 */
export function snippetOf(text: string, query: SearchQuery): readonly Piece[] {
  const first = query.firstIn(text);

  if (first === null) {
    return [{ text, found: false }];
  }

  let start = sentenceStart(text, first.start);

  if (first.start - start > REACH) {
    const near = text.lastIndexOf(' ', first.start - LEAD);

    start = near < start ? start : near + 1;
  }

  const shown = text.slice(start);
  const marks = query
    .matchesIn(shown)
    .map((mark) => ({ start: mark.start, end: mark.end }));
  const pieces = piecesOf(shown, marks);

  return start === 0 ? pieces : [{ text: ELLIPSIS, found: false }, ...pieces];
}

function sentenceStart(text: string, before: number): number {
  for (let at = before - 1; at > 0; at -= 1) {
    const char = text[at - 1];

    if ((char === '.' || char === '!' || char === '?' || char === ELLIPSIS) && /\s/.test(text[at] ?? '')) {
      let start = at;

      while (start < before && /\s/.test(text[start] ?? '')) {
        start += 1;
      }

      return start;
    }
  }

  return 0;
}
