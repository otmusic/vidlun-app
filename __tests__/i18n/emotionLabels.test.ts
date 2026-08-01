import { createTranslator, emotionKey, LOCALES } from '@/i18n';
import enEmotions from '@/i18n/locales/emotions.en.json';
import ukEmotions from '@/i18n/locales/emotions.uk.json';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';

const vocabulary = createEmotionVocabulary();
const shippedKeys = vocabulary.all().map((emotion) => emotionKey(emotion.id));

describe('emotion labels', () => {
  // Checked against the raw files rather than through `t`, because `emotionKey`
  // casts to TranslationKey and would hide a missing entry behind the types.
  it.each([
    ['en', enEmotions],
    ['uk', ukEmotions],
  ])('labels every shipped emotion in %s', (_locale, labels) => {
    const present = new Set(Object.keys(labels));
    const unlabelled = shippedKeys.filter((key) => !present.has(key));

    expect(unlabelled).toEqual([]);
  });

  it.each(LOCALES)('returns a non-empty label through the translator in %s', (locale) => {
    const translate = createTranslator(locale);

    expect(shippedKeys.filter((key) => translate(key).trim().length === 0)).toEqual([]);
  });

  it('carries no label for an emotion that does not exist', () => {
    const orphansEn = Object.keys(enEmotions).filter((key) => !shippedKeys.includes(key as never));
    const orphansUk = Object.keys(ukEmotions).filter((key) => !shippedKeys.includes(key as never));

    expect(orphansEn).toEqual([]);
    expect(orphansUk).toEqual([]);
  });

  it('reads a label out of the locale file rather than echoing the id', () => {
    const ukrainian = createTranslator('uk');
    const label = ukrainian(emotionKey('bad.tired.drained'));

    expect(label).toBe(ukEmotions['emotion.bad.tired.drained']);
    expect(label).not.toContain('bad.tired');
  });

  it('gives every locale a different word for the same id', () => {
    const english = createTranslator('en')(emotionKey('sad.lonely'));
    const ukrainian = createTranslator('uk')(emotionKey('sad.lonely'));

    expect(english).not.toBe(ukrainian);
  });
});
