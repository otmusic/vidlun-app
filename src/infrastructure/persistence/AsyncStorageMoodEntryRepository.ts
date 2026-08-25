import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IKeyValueStore } from './IKeyValueStore';
import { fromStored, toStored } from './moodEntryMapper';

export const ENTRY_KEY_PREFIX = 'luna.entry.';

/**
 * One key per entry rather than one blob for all of them: saving an entry then
 * never rewrites the rest, so a crash mid-save cannot cost the user a journal.
 */
export class AsyncStorageMoodEntryRepository implements IMoodEntryRepository {
  constructor(private readonly store: IKeyValueStore) {}

  async save(entry: MoodEntry): Promise<void> {
    await this.store.setItem(keyFor(entry.id), JSON.stringify(toStored(entry)));
  }

  async delete(id: string): Promise<void> {
    await this.store.removeItem(keyFor(id));
  }

  async findById(id: string): Promise<MoodEntry | null> {
    return readEntry(await this.store.getItem(keyFor(id)));
  }

  async findBetween(from: Date, to: Date): Promise<readonly MoodEntry[]> {
    const entries = await this.readAll();

    return entries.filter((entry) => entry.createdAt >= from && entry.createdAt < to);
  }

  async findRecent(limit: number): Promise<readonly MoodEntry[]> {
    return (await this.readAll()).slice(0, limit);
  }

  /** Newest first. */
  private async readAll(): Promise<readonly MoodEntry[]> {
    const keys = (await this.store.getAllKeys()).filter((key) => key.startsWith(ENTRY_KEY_PREFIX));

    if (keys.length === 0) {
      return [];
    }

    const stored = await this.store.multiGet(keys);

    return stored
      .map(([, value]) => readEntry(value))
      .filter((entry): entry is MoodEntry => entry !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

function keyFor(id: string): string {
  return `${ENTRY_KEY_PREFIX}${id}`;
}

/**
 * One unreadable record must not take the whole journal down with it. The
 * entry stays on disk untouched, so a later version can still rescue it.
 */
function readEntry(raw: string | null): MoodEntry | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return fromStored(parsed);
  } catch (failure) {
    console.warn('Skipping an unreadable stored entry.', failure);

    return null;
  }
}
