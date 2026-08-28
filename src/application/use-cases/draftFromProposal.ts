import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import { MoodEntry, type EntrySource } from '../../domain/entities/MoodEntry';
import type { ReflectionProposal } from '../../domain/ports/IReflectionAnalyzer';
import type { Confidence } from '../../domain/value-objects/Confidence';
import { MoodScore } from '../../domain/value-objects/MoodScore';

export interface DraftInput {
  readonly id: string;
  readonly createdAt: Date;
  readonly source: EntrySource;
  readonly rawTranscript: string;
  readonly confidence: Confidence;
  readonly proposal: ReflectionProposal;
  readonly vocabulary: EmotionVocabulary;
}

/**
 * The one place a model proposal becomes a draft, so a spoken entry and a
 * typed one cannot drift apart in how strictly they are read.
 */
export function draftFromProposal(input: DraftInput): MoodEntry {
  const cleaned = input.proposal.cleanTranscript.trim();

  return MoodEntry.create({
    id: input.id,
    createdAt: input.createdAt,
    source: input.source,
    rawTranscript: input.rawTranscript,
    // A model that returns an empty cleanup must not cost the user the entry.
    cleanTranscript: cleaned.length > 0 ? cleaned : input.rawTranscript,
    /*
     * Clamped when there is one, kept absent when there is not. Filling it in
     * would put a number in the entry that the person never gave and that the
     * week's average would then treat as one they did.
     */
    mood: input.proposal.mood === null ? null : MoodScore.clamped(input.proposal.mood),
    emotionIds: input.vocabulary.normalizeAiProposal(input.proposal.emotionIds, {
      maxDepth: input.confidence.maxEmotionDepth,
      limit: MoodEntry.MAX_EMOTIONS,
    }),
    contextTags: input.proposal.contextTags,
    // Written by a different model and arriving after the card is already on
    // screen, so a fresh draft never carries one.
    observation: null,
    confidence: input.confidence,
    safetyFlag: input.proposal.safetyFlag,
  });
}
