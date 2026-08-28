import type {
  DisagreementRecord,
  EntryRevisionRecord,
  IRevisionLog,
} from '../../domain/ports/IRevisionLog';
import type { IKeyValueStore } from './IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
export const REVISION_KEY_PREFIX = 'vidlun.revision.';

/**
 * Its own prefix, so the two never have to be told apart by reading them. A
 * correction and a refusal answer different questions about the model, and a
 * later count that mixed them would be quietly wrong rather than obviously so.
 */
export const DISAGREEMENT_KEY_PREFIX = 'vidlun.disagreement.';

/**
 * Append-only while the entry lives. These records are the only evidence of
 * what Vidlun got wrong, and personalization later cannot be back-filled from
 * entries alone — but they go when the entry does.
 */
export class AsyncStorageRevisionLog implements IRevisionLog {
  constructor(private readonly store: IKeyValueStore) {}

  async record(revision: EntryRevisionRecord): Promise<void> {
    const revisedAt = revision.revisedAt.toISOString();
    const key = `${REVISION_KEY_PREFIX}${revision.entryId}.${revisedAt}`;

    await this.store.setItem(
      key,
      JSON.stringify({
        entryId: revision.entryId,
        revisedAt,
        proposedMood: revision.proposedMood,
        finalMood: revision.finalMood,
        proposedEmotionIds: [...revision.proposedEmotionIds],
        finalEmotionIds: [...revision.finalEmotionIds],
      }),
    );
  }

  async disagree(disagreement: DisagreementRecord): Promise<void> {
    const at = disagreement.at.toISOString();
    const key = `${DISAGREEMENT_KEY_PREFIX}${disagreement.entryId}.${at}`;

    await this.store.setItem(
      key,
      JSON.stringify({
        entryId: disagreement.entryId,
        at,
        proposedEmotionIds: [...disagreement.proposedEmotionIds],
        selfEmotionIds: [...disagreement.selfEmotionIds],
      }),
    );
  }

  async forget(entryId: string): Promise<void> {
    // One entry can carry several of each, keyed by when they happened, so
    // this is a prefix sweep rather than a single removal. Both prefixes: a
    // refusal is made of what the person said and does not get to outlive the
    // entry they removed either.
    const prefixes = [
      `${REVISION_KEY_PREFIX}${entryId}.`,
      `${DISAGREEMENT_KEY_PREFIX}${entryId}.`,
    ];
    const keys = (await this.store.getAllKeys()).filter((key) =>
      prefixes.some((prefix) => key.startsWith(prefix)),
    );

    await Promise.all(keys.map((key) => this.store.removeItem(key)));
  }
}
