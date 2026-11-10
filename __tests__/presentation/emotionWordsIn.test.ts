import { createTranslator } from '@/i18n';
import { emotionLabel, emotionWordsIn } from '@/presentation/components/emotionDisplay';

const SPOKEN_UKRAINIAN = '\u0421\u044c\u043e\u0433\u043e\u0434\u043d\u0456 \u0434\u0443\u0436\u0435 \u0432\u0442\u043e\u043c\u0438\u0432\u0441\u044f.';
const TIRED_UK = '\u0412\u0442\u043e\u043c\u0430';

describe('the language an entry’s emotions are named in', () => {
  it('names a Ukrainian entry’s emotions in Ukrainian on an English phone', () => {
    const words = emotionWordsIn(SPOKEN_UKRAINIAN, createTranslator('en'));

    expect(emotionLabel('bad.tired', words)).toBe(TIRED_UK);
  });

  it('names an English entry’s emotions in English on a Ukrainian phone', () => {
    const words = emotionWordsIn('Very tired today.', createTranslator('uk'));

    expect(emotionLabel('bad.tired', words)).toBe('Tired');
  });

  it('keeps the app’s language when the entry gives nothing to go by', () => {
    const words = emotionWordsIn('...', createTranslator('en'));

    expect(emotionLabel('bad.tired', words)).toBe('Tired');
  });
});
