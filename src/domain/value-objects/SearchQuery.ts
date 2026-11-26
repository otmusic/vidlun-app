/** A word found in a text, by its place in the original string. */
export interface TextMatch {
  readonly start: number;
  readonly end: number;
}

/**
 * What separates words. Listed rather than described with Unicode classes,
 * which not every JavaScript engine the app runs on understands, and enough
 * for the languages people speak into Vidlun.
 */
const WORD = /[^\s.,!?;:()[\]{}"\u00ab\u00bb\u201e\u201c\u201d\u2018\u2026\u2014\u2013\-/\\*]+/g;

/**
 * What someone typed into the journal's search (owner's word, 2026-11-20):
 * letters, not meaning. Each typed word finds the words that begin with it,
 * so "meet" finds "meeting" and a Ukrainian stem finds its endings; every
 * typed word must be there for an entry to count; case, the three
 * apostrophes people type and the Russian yo against ye make no difference.
 */
export class SearchQuery {
  private constructor(private readonly words: readonly string[]) {}

  /** Null when nothing searchable was typed: spaces and punctuation alone. */
  static of(typed: string): SearchQuery | null {
    const words = wordsOf(typed).map((word) => word.text);

    return words.length === 0 ? null : new SearchQuery(words);
  }

  matches(text: string): boolean {
    const words = foldedWordsOf(text);

    return this.words.every((typed) => words.some((word) => word.startsWith(typed)));
  }

  /** Every word of the text one of the typed words begins, in the order they come. */
  matchesIn(text: string): readonly TextMatch[] {
    return wordsOf(text)
      .filter((word) => this.words.some((typed) => word.text.startsWith(typed)))
      .map(({ start, end }) => ({ start, end }));
  }

  firstIn(text: string): TextMatch | null {
    return this.matchesIn(text)[0] ?? null;
  }
}

interface Word extends TextMatch {
  readonly text: string;
}

/** Folded so that what was typed and what was said compare letter for letter. */
function fold(text: string): string {
  // One character in, one out, so places in the folded text are places in the original.
  return text.toLowerCase().replace(/[\u2019\u02bc`]/g, "'").replace(/\u0451/g, '\u0435');
}

/**
 * The folded words of each text searched lately. The journal is searched a
 * letter at a time, and each letter folded and split every transcript again:
 * a year of entries is some two hundred thousand characters and tens of
 * thousands of small objects per keystroke (performance review, 2026-11-26).
 * A transcript does not change while it is being searched, so its words are
 * kept, a few thousand texts at most.
 */
const FOLDED_KEPT = 4_000;
const foldedWords = new Map<string, readonly string[]>();

function foldedWordsOf(text: string): readonly string[] {
  const known = foldedWords.get(text);

  if (known !== undefined) {
    return known;
  }

  const words = wordsOf(text).map((word) => word.text);

  if (foldedWords.size >= FOLDED_KEPT) {
    foldedWords.clear();
  }

  foldedWords.set(text, words);

  return words;
}

function wordsOf(text: string): readonly Word[] {
  const folded = fold(text);
  const words: Word[] = [];

  for (const found of folded.matchAll(WORD)) {
    const start = found.index;
    const word = found[0].replace(/^'+|'+$/g, '');

    if (word.length > 0) {
      const lead = found[0].indexOf(word);

      words.push({ text: word, start: start + lead, end: start + lead + word.length });
    }
  }

  return words;
}
