import { localeOfText } from '@/i18n';

// Cyrillic is written as escapes: no Cyrillic in a .ts file, tests included.
const UKRAINIAN = '\u0421\u044c\u043e\u0433\u043e\u0434\u043d\u0456 \u0431\u0443\u0432 \u0437\u0432\u0438\u0447\u0430\u0439\u043d\u0438\u0439 \u0434\u0435\u043d\u044c.';
const RUSSIAN = '\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u0431\u044b\u043b \u043e\u0431\u044b\u0447\u043d\u044b\u0439 \u0434\u0435\u043d\u044c.';

describe('the language an entry is in', () => {
  it('reads a Ukrainian sentence as Ukrainian', () => {
    expect(localeOfText(UKRAINIAN)).toBe('uk');
  });

  it('reads an English sentence as English', () => {
    expect(localeOfText('Finished three tasks, happy, but very tired.')).toBe('en');
  });

  it('goes by most of the letters, so a brand name in a Ukrainian sentence does not flip it', () => {
    expect(localeOfText(`${UKRAINIAN} Vidlun.`)).toBe('uk');
  });

  it('names a Russian entry in Ukrainian, the nearest language the app has', () => {
    expect(localeOfText(RUSSIAN)).toBe('uk');
  });

  it('says nothing when there are no letters to go by', () => {
    expect(localeOfText('')).toBeNull();
    expect(localeOfText('12:30 ...')).toBeNull();
  });
});
