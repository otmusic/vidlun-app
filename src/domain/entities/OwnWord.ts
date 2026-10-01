/**
 * A feeling named in the person's own word, for when none of the vocabulary's
 * fits (owner's word, 2026-09-30).
 *
 * It travels in the same lists as the vocabulary's ids — the entry's kept
 * emotions, the words named before Vidlun answered — so the four-word ceiling,
 * the revision log and the granularity metric count it like any other. A
 * prefix no vocabulary id can carry keeps the two apart: the vocabulary's ids
 * are dot-separated English, and a colon is never one of their characters.
 *
 * The word itself is data, like a transcript, and is kept as typed. Vidlun
 * never proposes one: it is only ever the person's.
 */
const PREFIX = 'own:';

/** Long enough for a short phrase, short enough to sit on a chip. */
export const OWN_WORD_MAX_LENGTH = 40;

/**
 * The id for a typed word, tidied the way the vocabulary's labels read:
 * spaces collapsed, one capital at the start. Null when nothing was typed.
 */
export function ownWordId(word: string): string | null {
  const tidy = word.trim().replace(/\s+/g, ' ').slice(0, OWN_WORD_MAX_LENGTH).trim();

  if (tidy.length === 0) {
    return null;
  }

  const lower = tidy.toLocaleLowerCase();

  return `${PREFIX}${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`;
}

export function isOwnWord(id: string): boolean {
  return id.startsWith(PREFIX);
}

/** The word as the person reads it on a chip. */
export function ownWordText(id: string): string {
  return isOwnWord(id) ? id.slice(PREFIX.length) : id;
}
