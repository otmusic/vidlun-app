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
  readonly mood: MoodScore;
  readonly emotionIds?: readonly string[];
  readonly contextTags?: readonly string[];
  readonly observation?: string | null;
  readonly confidence: Confidence;
  readonly safetyFlag?: SafetyFlag;
  readonly wasRevisedByUser?: boolean;
}

/** What the user is allowed to correct on the reflection card. */
export interface EntryEdits {
  readonly cleanTranscript?: string;
  readonly mood?: MoodScore;
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
    readonly mood: MoodScore,
    readonly emotionIds: readonly string[],
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

    const emotionIds = unique(props.emotionIds ?? []);

    if (emotionIds.length > MAX_EMOTIONS) {
      throw new TooManyEmotionsError(emotionIds.length, MAX_EMOTIONS);
    }

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

  withMood(mood: MoodScore): MoodEntry {
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
   * "what Luna proposed vs what the user kept" stays diffable.
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
