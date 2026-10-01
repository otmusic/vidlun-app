import { Emotion } from '@/domain/entities/Emotion';
import { EMOTION_GROUPS, NEAR_COUNT, emotionsNear, groupOf, wordsWithoutReading } from '@/presentation/components/emotionTone';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';

function emotion(valence: number, energy: number) {
  return Emotion.create({ id: 'happy', valence, energy, tier: 'core' });
}

describe('emotion grouping', () => {
  it('separates pleasant states by what they do to the body', () => {
    expect(groupOf(emotion(5, 2))).toBe('pleasantCalm');
    expect(groupOf(emotion(5, 4))).toBe('pleasantEnergetic');
  });

  it('separates a hard state that keys you up from one that flattens you', () => {
    expect(groupOf(emotion(2, 4))).toBe('tense');
    expect(groupOf(emotion(2, 2))).toBe('heavy');
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

describe('the words offered for what was said', () => {
  const vocabulary = createEmotionVocabulary();
  const pool = vocabulary.all();
  const heard = (...ids: string[]) => ids.map((id) => vocabulary.find(id)!);

  it('offers a handful, not the palette', () => {
    expect(emotionsNear(heard('happy.content'), 5, pool)).toHaveLength(NEAR_COUNT);
  });

  it('leads with the words closest to what was heard', () => {
    expect(emotionsNear(heard('bad.tired'), 2, pool)[0]?.id).toBe('bad.tired');
  });

  it('offers no hard word for a pleasant reading', () => {
    const offered = emotionsNear(heard('happy.content', 'happy.optimistic'), 5, pool);

    expect(offered.every((emotion) => emotion.valence >= 4)).toBe(true);
  });

  it('offers no pleasant word for a hard reading', () => {
    const offered = emotionsNear(heard('sad.hurt', 'bad.tired'), 2, pool);

    expect(offered.every((emotion) => emotion.valence < 4)).toBe(true);
  });

  it('keeps both poles of a mixed reading rather than averaging them', () => {
    const offered = emotionsNear(heard('happy.proud', 'bad.tired'), 4, pool);

    expect(offered.some((emotion) => emotion.valence >= 4)).toBe(true);
    expect(offered.some((emotion) => emotion.valence <= 2)).toBe(true);
  });

  it('reads the mood when no feeling was heard', () => {
    expect(emotionsNear([], 5, pool).every((emotion) => emotion.valence >= 4)).toBe(true);
    expect(emotionsNear([], 1, pool).every((emotion) => emotion.valence < 4)).toBe(true);
  });

  it('never offers a sensitive word, nor a branch that is not a feeling', () => {
    const offered = [
      ...emotionsNear(heard('sad.lonely'), 1, pool),
      ...emotionsNear([], 3, pool),
    ];

    expect(offered.every((emotion) => emotion.isProposableByAi)).toBe(true);
    expect(offered.some((emotion) => emotion.id === 'compound')).toBe(false);
  });

  it('offers the broad words when there is no reading at all', () => {
    const offered = wordsWithoutReading(pool);

    expect(offered.map((emotion) => emotion.id)).toEqual([
      'happy',
      'surprised',
      'bad',
      'fearful',
      'angry',
      'disgusted',
      'sad',
    ]);
  });
});

