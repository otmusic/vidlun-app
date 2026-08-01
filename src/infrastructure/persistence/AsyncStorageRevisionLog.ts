import type { EntryRevisionRecord, IRevisionLog } from '../../domain/ports/IRevisionLog';
import type { IKeyValueStore } from './IKeyValueStore';

export const REVISION_KEY_PREFIX = 'luna.revision.';

/**
 * Append-only. These records are the only evidence of what Luna got wrong, and
 * personalization later cannot be back-filled from entries alone.
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
}
