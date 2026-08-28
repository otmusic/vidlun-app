import { BlankEntryIdError, EmptyTranscriptError, TooManyEmotionsError } from '../errors/MoodEntryErrors';
import type { Confidence } from '../value-objects/Confidence';
import type { MoodScore } from '../value-objects/MoodScore';

export type EntrySource = 'voice' | 'text';

/**
 * Set from what the entry says, never from which emotions the user picked.
 * People are allowed to feel bad without the product reacting.
 */
export type SafetyFlag = 'none' | 'distress' | 'crisis';

export interface MoodEntryProps {
  readonly id: string;
  readonly createdAt: Date;
  readonly source: EntrySource;
  readonly rawTranscript: string;
  readonly cleanTranscript: string;
  /**
   * Null when the entry said nothing about how the day was.
   *
   * An entry can describe what someone did and never once say how it felt, and
   * §6 already insists that zero emotions is a complete entry — the same is
   * true of the number. A three standing in for "it did not come up" is not an
   * even day, it is a non-answer wearing the shape of a measurement, and it
   * would go on to be averaged into the week as if it were one.
   */
  readonly mood: MoodScore | null;
  readonly emotionIds?: readonly string[];
  /**
   * What the person named before seeing any answer. Empty is a real value:
   * naming nothing is an answer, and it must not be confused with never having
   * been asked.
   */
  readonly selfEmotionIds?: readonly string[];
  /** Defaults to `emotionIds`, which is what a fresh draft's proposal is. */
  readonly proposedEmotionIds?: readonly string[];
  readonly contextTags?: readonly string[];
  readonly observation?: string | null;
  readonly confidence: Confidence;
  readonly safetyFlag?: SafetyFlag;
  readonly wasRevisedByUser?: boolean;
}

/** What the user is allowed to correct on the reflection card. */
export interface EntryEdits {
  readonly cleanTranscript?: string;
  readonly mood?: MoodScore | null;
  readonly emotionIds?: readonly string[];
  readonly contextTags?: readonly string[];
}

const MAX_EMOTIONS = 4;

export class MoodEntry {
  /** Four chips is the most a reflection card can show without becoming a form. */
  static readonly MAX_EMOTIONS = MAX_EMOTIONS;

  private constructor(
    readonly id: string,
    readonly createdAt: Date,
    readonly source: EntrySource,
    readonly rawTranscript: string,
    readonly cleanTranscript: string,
    readonly mood: MoodScore | null,
    readonly emotionIds: readonly string[],
    readonly selfEmotionIds: readonly string[],
    readonly proposedEmotionIds: readonly string[],
    readonly contextTags: readonly string[],
    readonly observation: string | null,
    readonly confidence: Confidence,
    readonly safetyFlag: SafetyFlag,
    readonly wasRevisedByUser: boolean,
  ) {}

  static create(props: MoodEntryProps): MoodEntry {
    if (props.id.trim().length === 0) {
      throw new BlankEntryIdError();
    }

    if (props.cleanTranscript.trim().length === 0) {
      throw new EmptyTranscriptError();
    }

    const emotionIds = withinLimit(unique(props.emotionIds ?? []));

    // Vidlun's own answer, kept whatever the user does next. On a fresh draft it
    // is the same list; the two only diverge once the user corrects the card.
    const proposedEmotionIds = withinLimit(unique(props.proposedEmotionIds ?? emotionIds));

    /*
     * The only unaided measurement the entry carries. It defaults to empty
     * rather than to either of the others: an entry made with the question
     * switched off has no unaided answer at all, and filling it in from what
     * was kept would count Vidlun's vocabulary as the person's.
     */
    const selfEmotionIds = withinLimit(unique(props.selfEmotionIds ?? []));

    const contextTags = unique((props.contextTags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0));
    const safetyFlag = props.safetyFlag ?? 'none';

    // A cheerful reflection on a crisis entry does harm. What the app shows
    // instead is a product decision, not the model's.
    const observation = safetyFlag === 'crisis' ? null : (props.observation ?? null);

    return new MoodEntry(
      props.id,
      new Date(props.createdAt.getTime()),
      props.source,
      props.rawTranscript,
      props.cleanTranscript,
      props.mood,
      Object.freeze(emotionIds),
      Object.freeze(selfEmotionIds),
      Object.freeze(proposedEmotionIds),
      Object.freeze(contextTags),
      observation,
      props.confidence,
      safetyFlag,
      props.wasRevisedByUser ?? false,
    );
  }

  /** Ordinary days exist: an entry with no emotions is complete, not a draft. */
  get hasEmotions(): boolean {
    return this.emotionIds.length > 0;
  }

  get needsUserReview(): boolean {
    return this.confidence.needsUserReview;
  }

  withMood(mood: MoodScore | null): MoodEntry {
    return this.copyWith({ mood });
  }

  withEmotionIds(emotionIds: readonly string[]): MoodEntry {
    return this.copyWith({ emotionIds });
  }

  withContextTags(contextTags: readonly string[]): MoodEntry {
    return this.copyWith({ contextTags });
  }

  withObservation(observation: string | null): MoodEntry {
    return this.copyWith({ observation });
  }

  withSafetyFlag(safetyFlag: SafetyFlag): MoodEntry {
    return this.copyWith({ safetyFlag });
  }

  /**
   * The user's own correction. Flagged separately from `with*` so that
   * "what Vidlun proposed vs what the user kept" stays diffable.
   */
  reviseWith(edits: EntryEdits): MoodEntry {
    return this.copyWith({ ...edits, wasRevisedByUser: true });
  }

  toProps(): Required<MoodEntryProps> {
    return {
      id: this.id,
      createdAt: this.createdAt,
      source: this.source,
      rawTranscript: this.rawTranscript,
      cleanTranscript: this.cleanTranscript,
      mood: this.mood,
      emotionIds: this.emotionIds,
      selfEmotionIds: this.selfEmotionIds,
      proposedEmotionIds: this.proposedEmotionIds,
      contextTags: this.contextTags,
      observation: this.observation,
      confidence: this.confidence,
      safetyFlag: this.safetyFlag,
      wasRevisedByUser: this.wasRevisedByUser,
    };
  }

  private copyWith(changes: Partial<MoodEntryProps>): MoodEntry {
    return MoodEntry.create({ ...this.toProps(), ...changes });
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function withinLimit(emotionIds: readonly string[]): readonly string[] {
  if (emotionIds.length > MAX_EMOTIONS) {
    throw new TooManyEmotionsError(emotionIds.length, MAX_EMOTIONS);
  }

  return emotionIds;
}
