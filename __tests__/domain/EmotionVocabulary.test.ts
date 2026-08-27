import type { EmotionDefinition } from '@/domain/entities/Emotion';
import { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { DuplicateEmotionIdError, MissingParentEmotionError } from '@/domain/errors/EmotionErrors';

/**
 * `sad.depressed` is deliberately sensitive at level 2 with an ordinary child,
 * which is the only shape that exercises the guard after depth lifting.
 */
const DEFINITIONS: readonly EmotionDefinition[] = [
  { id: 'happy', valence: 5, energy: 4, tier: 'core' },
  { id: 'sad', valence: 1, energy: 2, tier: 'core' },
  { id: 'bad', valence: 2, energy: 2, tier: 'core' },
  { id: 'happy.proud', valence: 5, energy: 4, tier: 'core' },
  { id: 'happy.proud.confident', valence: 5, energy: 4, tier: 'extended' },
  { id: 'happy.proud.successful', valence: 5, energy: 4, tier: 'extended' },
  { id: 'sad.lonely', valence: 1, energy: 2, tier: 'core' },
  { id: 'sad.lonely.abandoned', valence: 1, energy: 2, tier: 'sensitive' },
  { id: 'sad.depressed', valence: 1, energy: 2, tier: 'sensitive' },
  { id: 'sad.depressed.restless', valence: 2, energy: 4, tier: 'extended' },
  { id: 'bad.tired', valence: 2, energy: 2, tier: 'core' },
  { id: 'bad.tired.drained', valence: 1, energy: 2, tier: 'extended' },
];

const vocabulary = EmotionVocabulary.create(DEFINITIONS);

describe('EmotionVocabulary construction', () => {
  it('refuses a vocabulary that defines the same id twice', () => {
    expect(() =>
      EmotionVocabulary.create([
        { id: 'happy', valence: 5, energy: 4, tier: 'core' },
        { id: 'happy', valence: 4, energy: 2, tier: 'core' },
      ]),
    ).toThrow(DuplicateEmotionIdError);
  });

  it('refuses a child whose branch is missing', () => {
    expect(() =>
      EmotionVocabulary.create([{ id: 'sad.lonely', valence: 1, energy: 2, tier: 'core' }]),
    ).toThrow(MissingParentEmotionError);
  });

  it('holds every definition it was given', () => {
    expect(vocabulary.size).toBe(DEFINITIONS.length);
    expect(vocabulary.has('sad.lonely')).toBe(true);
    expect(vocabulary.has('sad.cheerful')).toBe(false);
    expect(vocabulary.find('sad.lonely')?.depth).toBe(2);
    expect(vocabulary.find('nope')).toBeUndefined();
  });
});

describe('hierarchy traversal', () => {
  it('keeps roots in the order the data lists them', () => {
    expect(vocabulary.roots().map((emotion) => emotion.id)).toEqual(['happy', 'sad', 'bad']);
  });

  it('returns the direct children of a branch', () => {
    expect(vocabulary.childrenOf('happy.proud').map((emotion) => emotion.id)).toEqual([
      'happy.proud.confident',
      'happy.proud.successful',
    ]);
  });

  it('returns nothing for a leaf or an unknown id', () => {
    expect(vocabulary.childrenOf('bad.tired.drained')).toEqual([]);
    expect(vocabulary.childrenOf('nope')).toEqual([]);
  });

  it('walks up from the most specific ancestor to the root', () => {
    expect(vocabulary.ancestorsOf('sad.lonely.abandoned').map((emotion) => emotion.id)).toEqual([
      'sad.lonely',
      'sad',
    ]);
  });

  it('gives a root and an unknown id no ancestors', () => {
    expect(vocabulary.ancestorsOf('sad')).toEqual([]);
    expect(vocabulary.ancestorsOf('nope')).toEqual([]);
  });
});

describe('depth lifting', () => {
  it('leaves an emotion alone when it is already broad enough', () => {
    expect(vocabulary.liftTo('sad.lonely', 3)?.id).toBe('sad.lonely');
    expect(vocabulary.liftTo('sad.lonely', 2)?.id).toBe('sad.lonely');
  });

  it('broadens a specific emotion rather than dropping it', () => {
    expect(vocabulary.liftTo('sad.lonely.abandoned', 2)?.id).toBe('sad.lonely');
    expect(vocabulary.liftTo('sad.lonely.abandoned', 1)?.id).toBe('sad');
  });

  it('cannot lift an emotion it does not know', () => {
    expect(vocabulary.liftTo('nope', 1)).toBeUndefined();
  });
});

describe('filtering model output', () => {
  it('drops ids that are not in the vocabulary', () => {
    expect(vocabulary.keepKnown(['happy.proud', 'happy.smug', 'sad'])).toEqual(['happy.proud', 'sad']);
  });

  it('drops sensitive states the model is not allowed to offer', () => {
    expect(vocabulary.keepProposableByAi(['sad.lonely', 'sad.lonely.abandoned', 'nope'])).toEqual([
      'sad.lonely',
    ]);
  });
});

describe('normalising an AI proposal', () => {
  const fullConfidence = { maxDepth: 3, limit: 4 } as const;

  it('never crashes on an emotion the model invented', () => {
    expect(vocabulary.normalizeAiProposal(['happy.proud', 'happy.smug'], fullConfidence)).toEqual([
      'happy.proud',
    ]);
  });

  it('keeps both poles of a mixed state instead of averaging them', () => {
    expect(
      vocabulary.normalizeAiProposal(['happy.proud.successful', 'bad.tired.drained'], fullConfidence),
    ).toEqual(['happy.proud.successful', 'bad.tired.drained']);
  });

  it('broadens every emotion when the transcript was only half heard', () => {
    expect(
      vocabulary.normalizeAiProposal(['happy.proud.successful', 'bad.tired.drained'], {
        maxDepth: 1,
        limit: 4,
      }),
    ).toEqual(['happy', 'bad']);
  });

  it('collapses siblings that lift onto the same parent', () => {
    expect(
      vocabulary.normalizeAiProposal(['happy.proud.confident', 'happy.proud.successful'], {
        maxDepth: 2,
        limit: 4,
      }),
    ).toEqual(['happy.proud']);
  });

  it('refuses to offer a sensitive state on its own', () => {
    expect(vocabulary.normalizeAiProposal(['sad.lonely.abandoned', 'sad.lonely'], fullConfidence)).toEqual([
      'sad.lonely',
    ]);
  });

  it('refuses an ordinary emotion whose broader form is sensitive', () => {
    expect(vocabulary.normalizeAiProposal(['sad.depressed.restless'], fullConfidence)).toEqual([
      'sad.depressed.restless',
    ]);
    expect(vocabulary.normalizeAiProposal(['sad.depressed.restless'], { maxDepth: 2, limit: 4 })).toEqual([]);
  });

  it('stops at the limit the entry can hold', () => {
    expect(
      vocabulary.normalizeAiProposal(['happy', 'sad', 'bad', 'happy.proud', 'sad.lonely'], {
        maxDepth: 3,
        limit: 4,
      }),
    ).toEqual(['happy', 'sad', 'bad', 'happy.proud']);
  });

  it('accepts an empty proposal, because ordinary days exist', () => {
    expect(vocabulary.normalizeAiProposal([], fullConfidence)).toEqual([]);
  });
});
