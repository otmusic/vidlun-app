import type { MoodEntry } from '../entities/MoodEntry';
import type { VoiceCue } from '../value-objects/VoiceCue';

/**
 * The paid monthly summary — the only one since 2026-10-01, when the weekly
 * piece went (owner's word). Runs on a stronger model than per-entry analysis.
 */
export interface INarrativeGenerator {
  /**
   * `voices` is how each spoken entry sounded against the person's usual
   * voice, by entry id (owner's word, 2026-11-18). An entry missing from it
   * was typed, not measured, or not to be remarked on.
   */
  generate(entries: readonly MoodEntry[], voices?: ReadonlyMap<string, VoiceCue>): Promise<string>;
}
