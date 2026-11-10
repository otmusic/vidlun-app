import type { IReviewAsks } from '../../domain/ports/IReviewAsks';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.reviewAskedIn';

/** The version that last asked for a rating, as a bare string. */
export class AsyncStorageReviewAsks implements IReviewAsks {
  constructor(private readonly store: IKeyValueStore) {}

  askedIn(): Promise<string | null> {
    return this.store.getItem(KEY);
  }

  remember(version: string): Promise<void> {
    return this.store.setItem(KEY, version);
  }
}
