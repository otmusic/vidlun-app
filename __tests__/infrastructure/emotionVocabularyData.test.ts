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

  it('names the everyday compound states the brief calls for', () => {
    for (const id of ['compound.money_anxiety', 'compound.awaiting', 'compound.good_tired']) {
      expect(vocabulary.has(id)).toBe(true);
    }
  });

  it('carries no human-language labels, only ids and metadata', () => {
    const fields = new Set(EMOTION_VOCABULARY_DATA.flatMap((definition) => Object.keys(definition)));

    expect([...fields].sort()).toEqual(['energy', 'id', 'tier', 'valence']);
  });

  it('gives every branch somewhere to drill down to', () => {
    for (const root of vocabulary.roots()) {
      expect(vocabulary.childrenOf(root.id).length).toBeGreaterThan(0);
    }
  });

  it('leaves a proposable emotion at every level of every branch', () => {
    for (const root of vocabulary.roots()) {
      expect(root.isProposableByAi).toBe(true);
    }
  });

  it('always has something safe to lift to when confidence is low', () => {
    for (const emotion of everyEmotion()) {
      expect(vocabulary.liftTo(emotion.id, 1)).toBeDefined();
    }
  });

  it('reserves the sensitive tier for states the model must not volunteer', () => {
    const sensitive = everyEmotion().filter((emotion) => !emotion.isProposableByAi);

    expect(sensitive.length).toBeGreaterThan(0);
    expect(vocabulary.keepProposableByAi(sensitive.map((emotion) => emotion.id))).toEqual([]);
  });
});
