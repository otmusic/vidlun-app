export interface SpeechThresholds {
  /** Under this, the model has too little audio to place a language at all. */
  readonly detectableFromMs: number;
  /** At or above this, the transcript held up under measurement. */
  readonly reliableFromMs: number;
}

/**
 * Measured on 2026-08-24 against 16 real recordings, not guessed. Word error
 * rate was 1.000 under four seconds, 0.231 between four and eight, and 0.120
 * above eight. See BACKLOG §1b.
 */
export const DEFAULT_SPEECH_THRESHOLDS: SpeechThresholds = {
  detectableFromMs: 4_000,
  reliableFromMs: 8_000,
};

/**
 * Neither reader reports a confidence of its own, so it comes from the one
 * predictor that measurement actually supported: how much the person said.
 * Everything downstream leans on this — §6 ties emotion depth to it, and a
 * low score lifts emotions to level 1 and flags the entry for review.
 */
export function confidenceFor(durationMs: number, thresholds: SpeechThresholds): number {
  if (durationMs >= thresholds.reliableFromMs) {
    return 0.9;
  }

  return durationMs >= thresholds.detectableFromMs ? 0.65 : 0.3;
}
