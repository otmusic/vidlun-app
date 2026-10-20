import type { EmotionDefinition } from '@/domain/entities/Emotion';
import { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { DuplicateEmotionIdError, MissingParentEmotionError } from '@/domain/errors/EmotionErrors';

/**
 * `sad.depressed` is deliberately sensitive with an ordinary child, and
 * `happy.proud.successful` is retired: a word old entries may hold and nothing
 * may offer again.
 */
const DEFINITIONS: readonly EmotionDefinition[] = [
  { id: 'happy', valence: 5, energy: 4, tier: 'core' },
  { id: 'sad', valence: 1, energy: 2, tier: 'core' },
  { id: 'bad', valence: 2, energy: 2, tier: 'core' },
  { id: 'happy.proud', valence: 5, energy: 4, tier: 'core' },
  { id: 'happy.proud.confident', valence: 5, energy: 4, tier: 'extended' },
  { id: 'happy.proud.successful', valence: 5, energy: 4, tier: 'extended', retired: true },
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

describe('retired words', () => {
  it('leaves them out of the words people are offered', () => {
    expect(vocabulary.current().map((emotion) => emotion.id)).not.toContain('happy.proud.successful');
    expect(vocabulary.current()).toHaveLength(DEFINITIONS.length - 1);
  });

  it('still knows them, so an old entry reads as it was', () => {
    expect(vocabulary.find('happy.proud.successful')?.retired).toBe(true);
    expect(vocabulary.keepKnown(['happy.proud.successful'])).toEqual(['happy.proud.successful']);
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
  const fullConfidence = { limit: 4 } as const;

  it('never crashes on an emotion the model invented', () => {
    expect(vocabulary.normalizeAiProposal(['happy.proud', 'happy.smug'], fullConfidence)).toEqual([
      'happy.proud',
    ]);
  });

  it('keeps both poles of a mixed state instead of averaging them', () => {
    expect(
      vocabulary.normalizeAiProposal(['happy.proud.confident', 'bad.tired.drained'], fullConfidence),
    ).toEqual(['happy.proud.confident', 'bad.tired.drained']);
  });

  it('keeps the words as they came rather than lifting them to broader ones', () => {
    // The list is flat since 2026-10-20: there is nothing broader to lift to.
    expect(vocabulary.normalizeAiProposal(['bad.tired.drained'], fullConfidence)).toEqual([
      'bad.tired.drained',
    ]);
  });

  it('names each word once', () => {
    expect(vocabulary.normalizeAiProposal(['bad.tired', 'bad.tired'], fullConfidence)).toEqual(['bad.tired']);
  });

  it('never proposes a retired word', () => {
    expect(
      vocabulary.normalizeAiProposal(['happy.proud.successful', 'happy.proud'], fullConfidence),
    ).toEqual(['happy.proud']);
  });

  it('refuses to offer a sensitive state on its own', () => {
    expect(vocabulary.normalizeAiProposal(['sad.lonely.abandoned', 'sad.lonely'], fullConfidence)).toEqual([
      'sad.lonely',
    ]);
  });

  it('lets an ordinary word through even when the one above it is sensitive', () => {
    expect(vocabulary.normalizeAiProposal(['sad.depressed.restless'], fullConfidence)).toEqual([
      'sad.depressed.restless',
    ]);
  });

  it('stops at the limit the entry can hold', () => {
    expect(
      vocabulary.normalizeAiProposal(['happy', 'sad', 'bad', 'happy.proud', 'sad.lonely'], fullConfidence),
    ).toEqual(['happy', 'sad', 'bad', 'happy.proud']);
  });

  it('accepts an empty proposal, because ordinary days exist', () => {
    expect(vocabulary.normalizeAiProposal([], fullConfidence)).toEqual([]);
  });
});
