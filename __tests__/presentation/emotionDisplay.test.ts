import { ownWordId } from '@/domain/entities/OwnWord';
import { createTranslator } from '@/i18n';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import { emotionLabel, emotionTint, moodTint } from '@/presentation/components/emotionDisplay';
import { darkPalette, lightPalette } from '@/presentation/theme/tokens';

const vocabulary = createEmotionVocabulary();
const light = { palette: lightPalette };
const dark = { palette: darkPalette };

describe('how an emotion is shown', () => {
  it("shows a word of the person's own as they typed it", () => {
    const own = ownWordId('nostalgia') ?? '';

    expect(emotionLabel(own, createTranslator('uk'))).toBe('Nostalgia');
  });

  it("shows a vocabulary word in the person's language", () => {
    expect(emotionLabel('bad.tired', createTranslator('en'))).toBe('Tired');
  });

  it('draws every vocabulary word in the one emotion blue', () => {
    // Owner's word, 2026-10-01: a feeling reads as a tag; colour is the mood's.
    expect(emotionTint('bad.tired', vocabulary, light)).toBe(lightPalette.tag);
    expect(emotionTint('happy.proud', vocabulary, light)).toBe(lightPalette.tag);
    expect(emotionTint('sad', vocabulary, dark)).toBe(darkPalette.tag);
  });

  it("draws a word of the person's own in the same blue, not in ink", () => {
    const own = ownWordId('nostalgia') ?? '';

    expect(emotionTint(own, vocabulary, light)).toBe(lightPalette.tag);
    expect(emotionTint(own, vocabulary, dark)).toBe(darkPalette.tag);
  });

  it('leaves the fallback to the caller for an id nobody knows', () => {
    expect(emotionTint('invented.state', vocabulary, light)).toBeUndefined();
  });
});

describe('how an entry is marked', () => {
  it("marks an entry in its mood's band on the scale, as the words split it", () => {
    // Very low and low are one band, even is the next, good and high the last.
    expect(moodTint(1, light)).toBe(lightPalette.low);
    expect(moodTint(2, light)).toBe(lightPalette.low);
    expect(moodTint(3, light)).toBe(lightPalette.tension);
    expect(moodTint(4, light)).toBe(lightPalette.calm);
    expect(moodTint(5, dark)).toBe(darkPalette.calm);
  });

  it('marks an entry that never said how the day was with the faint line', () => {
    expect(moodTint(null, light)).toBe(lightPalette.line);
  });
});
