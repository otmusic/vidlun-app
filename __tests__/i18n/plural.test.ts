import { createTranslator, LOCALES } from '@/i18n';
import { countedKey, pluralFormOf } from '@/i18n/plural';

/** Every prefix used with `countedKey` has to exist in all three forms. */
const COUNTED = ['stats.weekCount', 'stats.mention'];

describe('counted words', () => {
  it('takes the Ukrainian form the number actually calls for', () => {
    expect(pluralFormOf(1, 'uk')).toBe('One');
    expect(pluralFormOf(2, 'uk')).toBe('Few');
    expect(pluralFormOf(5, 'uk')).toBe('Many');
    expect(pluralFormOf(21, 'uk')).toBe('One');
    expect(pluralFormOf(22, 'uk')).toBe('Few');
  });

  it('treats the teens as the exception they are', () => {
    // The naive rule reads 11 as 1 and 12 as 2, and both are wrong.
    expect(pluralFormOf(11, 'uk')).toBe('Many');
    expect(pluralFormOf(12, 'uk')).toBe('Many');
    expect(pluralFormOf(111, 'uk')).toBe('Many');
  });

  it('never asks English for a form it does not have', () => {
    expect(pluralFormOf(1, 'en')).toBe('One');
    expect(pluralFormOf(2, 'en')).toBe('Many');
    expect(pluralFormOf(0, 'en')).toBe('Many');
  });

  it('has a translation for every form of every counted word', () => {
    for (const locale of LOCALES) {
      const t = createTranslator(locale);

      for (const prefix of COUNTED) {
        for (const count of [1, 2, 5]) {
          expect(t(countedKey(prefix, count, locale))).toEqual(expect.any(String));
          expect(t(countedKey(prefix, count, locale))).not.toBe('');
        }
      }
    }
  });
});
