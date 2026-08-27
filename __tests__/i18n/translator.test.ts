import { createTranslator, isLocale, LOCALES } from '@/i18n';

describe('translator', () => {
  it('resolves a key in the requested locale', () => {
    const translate = createTranslator('en');

    expect(translate('common.cancel')).toBe('Cancel');
  });

  it('returns a different string for each locale of the same key', () => {
    const english = createTranslator('en')('home.prompt');
    const ukrainian = createTranslator('uk')('home.prompt');

    expect(ukrainian).not.toBe(english);
  });

  it('leaves an unknown placeholder untouched instead of printing undefined', () => {
    const translate = createTranslator('en');

    expect(translate('app.name', { unrelated: 'x' })).toBe('Vidlun');
  });

  it('rejects a locale the app does not ship', () => {
    expect(isLocale('de')).toBe(false);
    expect(LOCALES.every(isLocale)).toBe(true);
  });
});
