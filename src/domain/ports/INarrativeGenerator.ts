import type { MoodEntry } from '../entities/MoodEntry';

/** The paid weekly summary. Runs on a stronger model than per-entry analysis. */
export interface INarrativeGenerator {
  generate(entries: readonly MoodEntry[]): Promise<string>;
}
