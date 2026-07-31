import type { SafetyFlag } from '../entities/MoodEntry';

/**
 * Raw model output. Nothing here is trusted: mood may be out of range and
 * emotion ids may not exist, both of which the use case corrects.
 */
export interface ReflectionProposal {
  readonly cleanTranscript: string;
  readonly mood: number;
  readonly emotionIds: readonly string[];
  readonly contextTags: readonly string[];
  readonly observation: string | null;
  readonly safetyFlag: SafetyFlag;
}

/** Per-entry analysis. Separate from narrative: different model, different cadence. */
export interface IReflectionAnalyzer {
  analyze(transcript: string): Promise<ReflectionProposal>;
}
