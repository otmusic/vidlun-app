import { affirmationsFor, LOCALES, localeOfText } from '@/i18n';

/** The page deals five at a time; a shorter list would leave it with gaps. */
const DEALT = 5;

describe('affirmationsFor', () => {
  it.each(LOCALES)('has enough in %s for the five the page deals', (locale) => {
    expect(affirmationsFor(locale).length).toBeGreaterThanOrEqual(DEALT);
  });

  it.each(LOCALES)('lists each one in %s once', (locale) => {
    const list = affirmationsFor(locale);

    expect(new Set(list).size).toBe(list.length);
  });

  it.each(LOCALES)('writes every one in %s in that language', (locale) => {
    for (const words of affirmationsFor(locale)) {
      expect(localeOfText(words)).toBe(locale);
    }
  });

  it.each(LOCALES)('ends every one in %s as a sentence, with no stray space', (locale) => {
    for (const words of affirmationsFor(locale)) {
      expect(words).toBe(words.trim());
      expect(words).toMatch(/[.!?]$/);
    }
  });

  it('uses the typographic apostrophe in Ukrainian, as the rest of its copy does', () => {
    for (const words of affirmationsFor('uk')) {
      expect(words).not.toContain("'");
    }
  });
});
