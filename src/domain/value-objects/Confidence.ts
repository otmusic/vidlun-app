import { InvalidConfidenceError } from '../errors/ValueObjectErrors';
import type { EmotionDepth } from './EmotionDepth';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Thresholds are a product decision, not a property of any speech engine: they
 * set how specific Vidlun is allowed to sound about what it heard.
 */
const HIGH_THRESHOLD = 0.8;
const MEDIUM_THRESHOLD = 0.5;

/** How sure the pipeline is that it heard the user correctly, 0 to 1. */
export class Confidence {
  private constructor(readonly value: number) {}

  static of(value: number): Confidence {
    if (Number.isNaN(value) || value < 0 || value > 1) {
      throw new InvalidConfidenceError(value);
    }

    return new Confidence(value);
  }

  /**
   * For speech-engine output. An unusable number means we do not know how well
   * we heard, and not knowing is the same risk as hearing badly.
   */
  static clamped(value: number): Confidence {
    if (Number.isNaN(value)) {
      return new Confidence(0);
    }

    return new Confidence(Math.min(1, Math.max(0, value)));
  }

  get level(): ConfidenceLevel {
    if (this.value >= HIGH_THRESHOLD) {
      return 'high';
    }

    return this.value >= MEDIUM_THRESHOLD ? 'medium' : 'low';
  }

  /**
   * Depth equals confidence. A shaky transcript may still yield `sad`, but not
   * `sad.lonely.abandoned` — a broad correct emotion beats a narrow invented one.
   */
  get maxEmotionDepth(): EmotionDepth {
    switch (this.level) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
    }
  }

  /** A transcript this weak is worth showing the user before it is trusted. */
  get needsUserReview(): boolean {
    return this.level === 'low';
  }

  equals(other: Confidence): boolean {
    return this.value === other.value;
  }
}
