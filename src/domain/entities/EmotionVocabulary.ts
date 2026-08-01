import { DuplicateEmotionIdError, MissingParentEmotionError } from '../errors/EmotionErrors';
import type { EmotionDepth } from '../value-objects/EmotionDepth';
import { Emotion, type EmotionDefinition } from './Emotion';

export interface AiProposalLimits {
  /** Lifted from `Confidence.maxEmotionDepth`. */
  readonly maxDepth: EmotionDepth;
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

  /**
   * Walk up the tree until the emotion is no deeper than `maxDepth`. Broadening
   * a correct emotion keeps the entry true; guessing a specific one does not.
   */
  liftTo(id: string, maxDepth: EmotionDepth): Emotion | undefined {
    const emotion = this.byId.get(id);

    if (emotion === undefined) {
      return undefined;
    }

    if (emotion.depth <= maxDepth) {
      return emotion;
    }

    return this.ancestorsOf(id).find((ancestor) => ancestor.depth <= maxDepth);
  }

  /** Model output referring to emotions we do not have is dropped, never fatal. */
  keepKnown(ids: readonly string[]): readonly string[] {
    return ids.filter((id) => this.byId.has(id));
  }

  keepProposableByAi(ids: readonly string[]): readonly string[] {
    return ids.filter((id) => this.byId.get(id)?.isProposableByAi === true);
  }

  /**
   * The full gate between what the model returned and what Luna is allowed to
   * show as a proposal.
   */
  normalizeAiProposal(ids: readonly string[], limits: AiProposalLimits): readonly string[] {
    const proposable = this.keepProposableByAi(this.keepKnown(ids));

    const lifted = proposable
      .map((id) => this.liftTo(id, limits.maxDepth))
      .filter((emotion): emotion is Emotion => emotion !== undefined)
      // Lifting can surface a sensitive ancestor of an otherwise ordinary leaf.
      .filter((emotion) => emotion.isProposableByAi)
      .map((emotion) => emotion.id);

    return [...new Set(lifted)].slice(0, limits.limit);
  }

  private parentOf(id: string): Emotion | undefined {
    const parentId = this.byId.get(id)?.parentId;

    return parentId == null ? undefined : this.byId.get(parentId);
  }
}
