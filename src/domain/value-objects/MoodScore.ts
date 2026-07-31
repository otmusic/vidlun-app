import { InvalidMoodScoreError } from '../errors/ValueObjectErrors';

export const MOOD_SCORE_MIN = 1;
export const MOOD_SCORE_MAX = 5;

/**
 * How the day rated, 1 to 5. Deliberately independent of the emotions on the
 * entry: someone can feel `bad.tired` and still call the day a 4.
 */
export class MoodScore {
  private constructor(readonly value: number) {}

  /** For user input and stored data, where an out-of-range value is a bug. */
  static of(value: number): MoodScore {
    if (!Number.isInteger(value) || value < MOOD_SCORE_MIN || value > MOOD_SCORE_MAX) {
      throw new InvalidMoodScoreError(value, MOOD_SCORE_MIN, MOOD_SCORE_MAX);
    }

    return new MoodScore(value);
  }

  /**
   * For model output. A language model can return 7, 0 or 3.5; that is a
   * reason to correct it, never a reason to fail the user's entry.
   */
  static clamped(value: number): MoodScore {
    if (Number.isNaN(value)) {
      return new MoodScore(MOOD_SCORE_MIN + Math.floor((MOOD_SCORE_MAX - MOOD_SCORE_MIN) / 2));
    }

    const whole = Math.round(value);

    return new MoodScore(Math.min(MOOD_SCORE_MAX, Math.max(MOOD_SCORE_MIN, whole)));
  }

  equals(other: MoodScore): boolean {
    return this.value === other.value;
  }
}
