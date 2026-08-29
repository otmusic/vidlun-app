/** A stretch of a sentence, and whether it is the part being insisted on. */
export interface Run {
  readonly text: string;
  readonly strong: boolean;
}

/**
 * Splits `a *b* c` into three runs.
 *
 * The legal documents carry emphasis that matters — "does not diagnose", "we
 * cannot issue a refund" — and dropping it would flatten the one sentence on
 * the screen that has to be read. Markdown's asterisks survive into the JSON
 * for exactly this, and nothing else in them needs parsing.
 *
 * An unclosed asterisk is text. A document is not a place to lose a character
 * because someone typed a footnote mark.
 */
export function runsOf(text: string): readonly Run[] {
  const parts = text.split('*');

  if (parts.length % 2 === 0) {
    return [{ text, strong: false }];
  }

  return parts
    .map((part, index) => ({ text: part, strong: index % 2 === 1 }))
    .filter((run) => run.text.length > 0);
}
