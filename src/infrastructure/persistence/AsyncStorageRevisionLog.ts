import type { EntryRevisionRecord, IRevisionLog } from '../../domain/ports/IRevisionLog';
import type { IKeyValueStore } from './IKeyValueStore';

export const REVISION_KEY_PREFIX = 'luna.revision.';

/**
 * Append-only while the entry lives. These records are the only evidence of
 * what Luna got wrong, and personalization later cannot be back-filled from
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

  async forget(entryId: string): Promise<void> {
    // One entry can carry several revisions, each keyed by when it happened,
    // so this is a prefix sweep rather than a single removal.
    const prefix = `${REVISION_KEY_PREFIX}${entryId}.`;
    const keys = (await this.store.getAllKeys()).filter((key) => key.startsWith(prefix));

    await Promise.all(keys.map((key) => this.store.removeItem(key)));
  }
}
