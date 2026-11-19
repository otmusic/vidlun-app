import type { IBackupLedger } from '../../domain/ports/IBackupLedger';
import type { IKeyValueStore } from './IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.lastBackup';

/** The moment as an ISO string under one key; anything unreadable reads as no backup yet. */
export class AsyncStorageBackupLedger implements IBackupLedger {
  constructor(private readonly store: IKeyValueStore) {}

  async last(): Promise<Date | null> {
    const raw = await this.store.getItem(KEY);

    if (raw === null) {
      return null;
    }

    const at = new Date(raw);

    return Number.isNaN(at.getTime()) ? null : at;
  }

  record(at: Date): Promise<void> {
    return this.store.setItem(KEY, at.toISOString());
  }
}
