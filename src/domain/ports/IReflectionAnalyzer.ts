import type { SafetyFlag } from '../entities/MoodEntry';
import type { VoiceCue } from '../value-objects/VoiceCue';

/**
 * Raw model output. Nothing here is trusted: mood may be out of range and
 * emotion ids may not exist, both of which the use case corrects.
 */
export interface ReflectionProposal {
  readonly cleanTranscript: string;
  /** Null where the sentence never said how the day was. */
  readonly mood: number | null;
  readonly emotionIds: readonly string[];
  /**
   * Other words that fit what was said, the most fitting first, for the
   * question card to offer beside the ones heard. Choices put in front of
   * the person, never claims about them: none reaches the entry unless they
   * pick it.
   */
  readonly nearbyEmotionIds: readonly string[];
  readonly contextTags: readonly string[];
  readonly safetyFlag: SafetyFlag;
}

/**
 * Per-entry analysis. Separate from narrative and from the observation:
 * different models, different cadences, different reasons to change.
 */
export interface IReflectionAnalyzer {
  /**
   * `voice`, when there is one, is how the take sounded against the person's
   * usual voice: a hint for choosing between words the sentence supports,
   * never a reason on its own.
   */
  analyze(transcript: string, voice?: VoiceCue | null): Promise<ReflectionProposal>;
}
