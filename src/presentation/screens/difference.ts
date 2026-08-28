/**
 * Which of the five things the card has to say about two answers.
 *
 * Pure and separate from the screen because it is the one piece of the
 * comparison that could be wrong in a way nobody would notice by looking: the
 * copy reads fine in every case, and only the choice between them can be off.
 */
export type DifferenceKind = 'quiet' | 'silent' | 'same' | 'more' | 'missing' | 'other';

export interface Difference {
  readonly kind: DifferenceKind;
  /** The word the sentence is about, where there is one. */
  readonly word?: string;
  /** For two answers that simply differ, one from each side. */
  readonly mine?: string;
  readonly theirs?: string;
}

export function differenceBetween(
  mine: readonly string[],
  theirs: readonly string[],
): Difference {
  /*
   * Neither side found a word, which is not the same as the person alone
   * staying quiet: `silent` promises that Vidlun's answer is sitting beside
   * theirs, and here there is nothing to sit there. An entry about which model
   * to use holds no feeling, §6 says an empty proposal is the correct answer to
   * that, and the screen has to be able to say so.
   */
  if (mine.length === 0 && theirs.length === 0) {
    return { kind: 'quiet' };
  }

  // Saying nothing is an answer, and it is the first one to recognise: every
  // other case below would read as a correction of a word that was never given.
  if (mine.length === 0) {
    return { kind: 'silent' };
  }

  const unheard = mine.filter((id) => !theirs.includes(id));
  const extra = theirs.filter((id) => !mine.includes(id));

  if (unheard.length === 0 && extra.length === 0) {
    return { kind: 'same' };
  }

  if (unheard.length === 0) {
    return { kind: 'more', word: extra[0] };
  }

  if (extra.length === 0) {
    return { kind: 'missing', word: unheard[0] };
  }

  return { kind: 'other', mine: unheard[0], theirs: extra[0] };
}
