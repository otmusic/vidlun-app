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
 * A draft, and the other words its reading put beside it for the question
 * card to offer (owner's word, 2026-10-23: the card's words read as if
 * Vidlun had not listened while they came off the chart alone). The words
 * are choices, never claims, and stay off the draft: nothing of them reaches
 * the entry unless the person picks one.
 */
export interface Reading {
  readonly draft: MoodEntry;
  readonly nearbyEmotionIds: readonly string[];
}

/** As many as the card has room for; the model is asked for no more. */
const MAX_NEARBY = 8;

/**
 * A draft and the words beside it, both through the same gate: the card
 * offers only what Vidlun may propose — known, current, never sensitive —
 * each word once, and none it already heard.
 */
export function readingFromProposal(input: DraftInput): Reading {
  const draft = draftFromProposal(input);
  const nearby = input.vocabulary
    .keepProposableByAi(input.vocabulary.keepKnown(input.proposal.nearbyEmotionIds))
    .filter((id) => !draft.emotionIds.includes(id));

  return { draft, nearbyEmotionIds: [...new Set(nearby)].slice(0, MAX_NEARBY) };
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
