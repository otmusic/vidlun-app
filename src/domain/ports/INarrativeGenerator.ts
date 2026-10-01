import type { MoodEntry } from '../entities/MoodEntry';

/**
 * The paid monthly summary — the only one since 2026-10-01, when the weekly
 * piece went (owner's word). Runs on a stronger model than per-entry analysis.
 */
export interface INarrativeGenerator {
  generate(entries: readonly MoodEntry[]): Promise<string>;
}
