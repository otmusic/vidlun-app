import type { IUnheardEntries } from '../../domain/ports/IUnheardEntries';
import type { IKeyValueStore } from './IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.unheardEntries';

/**
 * The ids, as one JSON list under one key. Reads and writes take turns so
 * that an entry saved while the last one is being crossed off is not lost
 * between the two.
 */
export class AsyncStorageUnheardEntries implements IUnheardEntries {
  private turn: Promise<unknown> = Promise.resolve();

  constructor(private readonly store: IKeyValueStore) {}

  add(entryId: string): Promise<void> {
    return this.change((ids) => (ids.includes(entryId) ? ids : [...ids, entryId]));
  }

  async ids(): Promise<readonly string[]> {
    return readIds(await this.store.getItem(KEY));
  }

  remove(entryId: string): Promise<void> {
    return this.change((ids) => ids.filter((id) => id !== entryId));
  }

  private change(edit: (ids: readonly string[]) => readonly string[]): Promise<void> {
    const work = async (): Promise<void> => {
      const edited = edit(await this.ids());

      if (edited.length === 0) {
        await this.store.removeItem(KEY);
      } else {
        await this.store.setItem(KEY, JSON.stringify(edited));
      }
    };
    const result = this.turn.then(work, work);

    this.turn = result.catch(() => undefined);

    return result;
  }
}

function readIds(raw: string | null): readonly string[] {
  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
