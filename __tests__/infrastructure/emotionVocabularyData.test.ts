import type { Emotion } from '@/domain/entities/Emotion';
import {
  createEmotionVocabulary,
  EMOTION_VOCABULARY_DATA,
} from '@/infrastructure/analysis/emotionVocabularyData';

const vocabulary = createEmotionVocabulary();

function everyEmotion(): readonly Emotion[] {
  return EMOTION_VOCABULARY_DATA.map((definition) => vocabulary.find(definition.id)).filter(
    (emotion): emotion is Emotion => emotion !== undefined,
  );
}

describe('the shipped emotion vocabulary', () => {
  it('builds, which means every id is well formed and every parent exists', () => {
    expect(vocabulary.size).toBe(EMOTION_VOCABULARY_DATA.length);
  });

  it('covers the seven Feeling Wheel branches plus compound states', () => {
    expect(vocabulary.roots().map((emotion) => emotion.id)).toEqual([
      'happy',
      'surprised',
      'bad',
      'fearful',
      'angry',
      'disgusted',
      'sad',
      'compound',
    ]);
  });

  it('offers exactly the owner’s list of seventy-six words', () => {
    // The list of 2026-10-20; everything else in the data is retired.
    expect(vocabulary.current()).toHaveLength(76);
    expect(vocabulary.find('disgusted.nonacceptance')?.retired).toBe(false);
    expect(vocabulary.find('compound.burnout')?.retired).toBe(false);
  });

  it('keeps the words that left the list, so old entries still read', () => {
    for (const id of ['compound.good_tired', 'happy.accepted', 'sad.hurt', 'bad']) {
      expect(vocabulary.find(id)?.retired).toBe(true);
    }
  });

  it('carries no human-language labels, only ids and metadata', () => {
    const fields = new Set(EMOTION_VOCABULARY_DATA.flatMap((definition) => Object.keys(definition)));

    expect([...fields].sort()).toEqual(['energy', 'id', 'retired', 'tier', 'valence']);
  });

  it('gives every branch somewhere to drill down to', () => {
    for (const root of vocabulary.roots()) {
      expect(vocabulary.childrenOf(root.id).length).toBeGreaterThan(0);
    }
  });

  it('lets the model name every current word except the sensitive ones', () => {
    const current = vocabulary.current();
    const proposable = current.filter((emotion) => emotion.isProposableByAi);

    expect(proposable.length).toBe(current.filter((emotion) => emotion.tier !== 'sensitive').length);
    expect(everyEmotion().filter((emotion) => emotion.retired).every((emotion) => !emotion.isProposableByAi)).toBe(
      true,
    );
  });

  it('reserves the sensitive tier for states the model must not volunteer', () => {
    const sensitive = everyEmotion().filter((emotion) => !emotion.isProposableByAi);

    expect(sensitive.length).toBeGreaterThan(0);
    expect(vocabulary.keepProposableByAi(sensitive.map((emotion) => emotion.id))).toEqual([]);
  });
});
