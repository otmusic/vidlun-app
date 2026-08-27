import {
  InvalidEmotionEnergyError,
  InvalidEmotionIdError,
  InvalidEmotionValenceError,
} from '../errors/EmotionErrors';
import { isEmotionDepth, MAX_EMOTION_DEPTH, type EmotionDepth } from '../value-objects/EmotionDepth';

/**
 * 1 (still) to 5 (activated) — what the state does to the body, on the same
 * scale as valence. It used to be a pair of words, which was enough to sort
 * the drill-down into four shelves and nothing more; a number lets colour be
 * derived from the two axes rather than assigned by hand to 125 words.
 */
export type EmotionEnergy = number;

/**
 * `core` and `extended` are freely proposable. `sensitive` covers states like
 * worthlessness: offering one in a single tap can push someone deeper than
 * they actually feel, so only the user may choose them.
 */
export type EmotionTier = 'core' | 'extended' | 'sensitive';

/** A vocabulary row. Depth and parent are read off the id, never retyped. */
export interface EmotionDefinition {
  readonly id: string;
  readonly valence: number;
  readonly energy: EmotionEnergy;
  readonly tier: EmotionTier;
}

const ID_SEGMENT = /^[a-z][a-z0-9_]*$/;
const ID_SEPARATOR = '.';
const SCALE_MIN = 1;
const SCALE_MAX = 5;

function withinScale(value: number): boolean {
  return Number.isInteger(value) && value >= SCALE_MIN && value <= SCALE_MAX;
}

export class Emotion {
  private constructor(
    readonly id: string,
    readonly depth: EmotionDepth,
    readonly valence: number,
    readonly energy: EmotionEnergy,
    readonly tier: EmotionTier,
    readonly parentId: string | null,
  ) {}

  static create(definition: EmotionDefinition): Emotion {
    const segments = parseSegments(definition.id);

    if (!withinScale(definition.valence)) {
      throw new InvalidEmotionValenceError(definition.id, definition.valence);
    }

    if (!withinScale(definition.energy)) {
      throw new InvalidEmotionEnergyError(definition.id, definition.energy);
    }

    const depth = segments.length;

    if (!isEmotionDepth(depth)) {
      throw new InvalidEmotionIdError(
        definition.id,
        `the wheel is ${MAX_EMOTION_DEPTH} levels deep, this id has ${depth}.`,
      );
    }

    const parentId = depth === 1 ? null : segments.slice(0, -1).join(ID_SEPARATOR);

    return new Emotion(definition.id, depth, definition.valence, definition.energy, definition.tier, parentId);
  }

  /** The Feeling Wheel branch this belongs to, e.g. `sad` for `sad.lonely.abandoned`. */
  get rootId(): string {
    return this.parentId === null ? this.id : this.id.slice(0, this.id.indexOf(ID_SEPARATOR));
  }

  get isProposableByAi(): boolean {
    return this.tier !== 'sensitive';
  }

  isDescendantOf(ancestorId: string): boolean {
    return this.id.startsWith(`${ancestorId}${ID_SEPARATOR}`);
  }
}

function parseSegments(id: string): readonly string[] {
  if (id.length === 0) {
    throw new InvalidEmotionIdError(id, 'an id cannot be empty.');
  }

  const segments = id.split(ID_SEPARATOR);

  if (!segments.every((segment) => ID_SEGMENT.test(segment))) {
    throw new InvalidEmotionIdError(
      id,
      'every segment must be lower-case English letters, digits or underscores, starting with a letter.',
    );
  }

  return segments;
}
