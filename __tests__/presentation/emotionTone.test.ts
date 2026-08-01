import { Emotion } from '@/domain/entities/Emotion';
import { EMOTION_GROUPS, groupOf, toneOf } from '@/presentation/components/emotionTone';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';

function emotion(valence: number, energy: 'high' | 'low') {
  return Emotion.create({ id: 'happy', valence, energy, tier: 'core' });
}

describe('emotion grouping', () => {
  it('separates pleasant states by what they do to the body', () => {
    expect(groupOf(emotion(5, 'low'))).toBe('pleasantCalm');
    expect(groupOf(emotion(5, 'high'))).toBe('pleasantEnergetic');
  });

  it('separates a hard state that keys you up from one that flattens you', () => {
    expect(groupOf(emotion(2, 'high'))).toBe('tense');
    expect(groupOf(emotion(2, 'low'))).toBe('heavy');
  });

  it('never paints a difficult state as an error', () => {
    expect(toneOf(emotion(1, 'low'))).toBe('low');
    expect(toneOf(emotion(2, 'high'))).toBe('tension');
    expect(toneOf(emotion(5, 'low'))).toBe('calm');
  });

  it('places every shipped emotion in exactly one group', () => {
    const grouped = createEmotionVocabulary()
      .all()
      .map((each) => groupOf(each));

    expect(grouped.every((group) => EMOTION_GROUPS.includes(group))).toBe(true);
  });

  it('offers something in every group at the two levels the picker shows', () => {
    const offered = createEmotionVocabulary()
      .all()
      .filter((each) => each.depth <= 2);

    for (const group of EMOTION_GROUPS) {
      expect(offered.filter((each) => groupOf(each) === group).length).toBeGreaterThan(0);
    }
  });
});
