import type { Locale, TranslationKey } from './index';

/**
 * Which of three forms a count takes.
 *
 * Ukrainian needs all three — one entry, two entries and five entries take
 * three different endings — and getting it wrong is the kind of mistake that
 * makes an app read as translated. English has two and simply never asks for
 * `few`, so one rule covers both and the locale files decide what each form
 * says.
 */
export type PluralForm = 'One' | 'Few' | 'Many';

export function pluralFormOf(count: number, locale: Locale): PluralForm {
  if (locale === 'en') {
    return count === 1 ? 'One' : 'Many';
  }

  const last = count % 10;
  const lastTwo = count % 100;

  // The teens are the exception the naive rule gets wrong: 11 and 111 take the
  // same form as 5, not the same form as 1.
  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'Many';
  }

  if (last === 1) {
    return 'One';
  }

  return last >= 2 && last <= 4 ? 'Few' : 'Many';
}

/**
 * `stats.weekCount` plus the form becomes `stats.weekCountFew`. The cast is
 * covered by a test asserting every counted key exists in all three forms in
 * every locale.
 */
export function countedKey(prefix: string, count: number, locale: Locale): TranslationKey {
  return `${prefix}${pluralFormOf(count, locale)}` as TranslationKey;
}
