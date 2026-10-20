import { DuplicateEmotionIdError, MissingParentEmotionError } from '../errors/EmotionErrors';
import { Emotion, type EmotionDefinition } from './Emotion';

export interface AiProposalLimits {
  /** Lifted from `MoodEntry.MAX_EMOTIONS`. */
  readonly limit: number;
}

/** The Feeling Wheel as a navigable tree. Insertion order is preserved. */
export class EmotionVocabulary {
  private constructor(
    private readonly byId: ReadonlyMap<string, Emotion>,
    private readonly childrenByParentId: ReadonlyMap<string, readonly Emotion[]>,
    private readonly rootEmotions: readonly Emotion[],
  ) {}

  static create(definitions: readonly EmotionDefinition[]): EmotionVocabulary {
    const byId = new Map<string, Emotion>();

    for (const definition of definitions) {
      const emotion = Emotion.create(definition);

      if (byId.has(emotion.id)) {
        throw new DuplicateEmotionIdError(emotion.id);
      }

      byId.set(emotion.id, emotion);
    }

    const childrenByParentId = new Map<string, Emotion[]>();
    const rootEmotions: Emotion[] = [];

    for (const emotion of byId.values()) {
      if (emotion.parentId === null) {
        rootEmotions.push(emotion);
        continue;
      }

      if (!byId.has(emotion.parentId)) {
        throw new MissingParentEmotionError(emotion.id, emotion.parentId);
      }

      const siblings = childrenByParentId.get(emotion.parentId) ?? [];

      siblings.push(emotion);
      childrenByParentId.set(emotion.parentId, siblings);
    }

    return new EmotionVocabulary(byId, childrenByParentId, rootEmotions);
  }

  get size(): number {
    return this.byId.size;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  find(id: string): Emotion | undefined {
    return this.byId.get(id);
  }

  roots(): readonly Emotion[] {
    return this.rootEmotions;
  }

  /** The words people are offered now, in the data's order: everything not retired. */
  current(): readonly Emotion[] {
    return [...this.byId.values()].filter((emotion) => !emotion.retired);
  }

  all(): readonly Emotion[] {
    return [...this.byId.values()];
  }

  childrenOf(id: string): readonly Emotion[] {
    return this.childrenByParentId.get(id) ?? [];
  }

  /** Nearest parent first, so callers can stop at the first acceptable level. */
  ancestorsOf(id: string): readonly Emotion[] {
    const ancestors: Emotion[] = [];
    let parent = this.parentOf(id);

    while (parent !== undefined) {
      ancestors.push(parent);
      parent = this.parentOf(parent.id);
    }

    return ancestors;
  }

  /** Model output referring to emotions we do not have is dropped, never fatal. */
  keepKnown(ids: readonly string[]): readonly string[] {
    return ids.filter((id) => this.byId.has(id));
  }

  keepProposableByAi(ids: readonly string[]): readonly string[] {
    return ids.filter((id) => this.byId.get(id)?.isProposableByAi === true);
  }

  /**
   * The full gate between what the model returned and what Vidlun is allowed to
   * show as a proposal: words it knows, current and not sensitive, each once.
   *
   * Nothing is lifted to a broader word any more. Since the owner's flat list
   * of 2026-10-20 there is no broader word to lift to, and a shaky transcript
   * is answered by asking the person to look (`Confidence.needsUserReview`),
   * not by swapping their words for ones further up a tree.
   */
  normalizeAiProposal(ids: readonly string[], limits: AiProposalLimits): readonly string[] {
    return [...new Set(this.keepProposableByAi(this.keepKnown(ids)))].slice(0, limits.limit);
  }

  private parentOf(id: string): Emotion | undefined {
    const parentId = this.byId.get(id)?.parentId;

    return parentId == null ? undefined : this.byId.get(parentId);
  }
}
