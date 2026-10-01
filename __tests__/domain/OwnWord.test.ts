import { OWN_WORD_MAX_LENGTH, isOwnWord, ownWordId, ownWordText } from '@/domain/entities/OwnWord';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';

describe("a feeling named in the person's own word", () => {
  it('keeps the word as typed, tidied into a label', () => {
    const id = ownWordId('  drained   and  flat ');

    expect(id).not.toBeNull();
    expect(ownWordText(id ?? '')).toBe('Drained and flat');
  });

  it('is told apart from every word the vocabulary ships', () => {
    const vocabulary = createEmotionVocabulary();

    expect(isOwnWord(ownWordId('drained') ?? '')).toBe(true);
    expect(vocabulary.all().some((emotion) => isOwnWord(emotion.id))).toBe(false);
  });

  it('is nothing at all when nothing was typed', () => {
    expect(ownWordId('   ')).toBeNull();
  });

  it('stays short enough to sit on a chip', () => {
    expect(ownWordText(ownWordId('x'.repeat(100)) ?? '')).toHaveLength(OWN_WORD_MAX_LENGTH);
  });

  it('names the same word the same way however it was typed', () => {
    expect(ownWordId('DRAINED')).toBe(ownWordId('drained'));
  });
});
