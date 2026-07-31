import { Emotion } from '@/domain/entities/Emotion';
import { InvalidEmotionIdError, InvalidEmotionValenceError } from '@/domain/errors/EmotionErrors';

function make(id: string, overrides: { valence?: number; tier?: 'core' | 'extended' | 'sensitive' } = {}) {
  return Emotion.create({
    id,
    valence: overrides.valence ?? 3,
    energy: 'low',
    tier: overrides.tier ?? 'core',
  });
}

describe('Emotion', () => {
  it('reads depth and parent off the id so the two can never disagree', () => {
    const emotion = make('sad.lonely.abandoned');

    expect(emotion.depth).toBe(3);
    expect(emotion.parentId).toBe('sad.lonely');
  });

  it('gives a root emotion no parent', () => {
    const emotion = make('sad');

    expect(emotion.depth).toBe(1);
    expect(emotion.parentId).toBeNull();
  });

  it('names the branch an emotion belongs to', () => {
    expect(make('sad.lonely.abandoned').rootId).toBe('sad');
    expect(make('sad').rootId).toBe('sad');
  });

  it('knows its own line of descent', () => {
    const emotion = make('sad.lonely.abandoned');

    expect(emotion.isDescendantOf('sad')).toBe(true);
    expect(emotion.isDescendantOf('sad.lonely')).toBe(true);
    expect(emotion.isDescendantOf('happy')).toBe(false);
    expect(emotion.isDescendantOf('sad.lonely.abandoned')).toBe(false);
  });

  it('does not treat a longer sibling name as a descendant', () => {
    expect(make('sad.lonelyish').isDescendantOf('sad.lonely')).toBe(false);
  });

  it.each(['', 'Sad', 'sad..lonely', '1sad', 'sad.lonely!', 'sad lonely'])(
    'refuses %p as an id',
    (id) => {
      expect(() => make(id)).toThrow(InvalidEmotionIdError);
    },
  );

  it('refuses a fourth level, because the wheel has three', () => {
    expect(() => make('sad.lonely.abandoned.utterly')).toThrow(InvalidEmotionIdError);
  });

  it.each([0, 6, 2.5])('refuses valence %p', (valence) => {
    expect(() => make('sad', { valence })).toThrow(InvalidEmotionValenceError);
  });

  it('marks sensitive states as off-limits for the model', () => {
    expect(make('fearful.weak.worthless', { tier: 'sensitive' }).isProposableByAi).toBe(false);
    expect(make('happy.proud', { tier: 'core' }).isProposableByAi).toBe(true);
    expect(make('happy.proud.confident', { tier: 'extended' }).isProposableByAi).toBe(true);
  });
});
