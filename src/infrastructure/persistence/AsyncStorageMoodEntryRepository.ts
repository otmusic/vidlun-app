import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IKeyValueStore } from './IKeyValueStore';
import { fromStored, toStored } from './moodEntryMapper';

/**
 * A storage key is an address, not a label. This one could follow the rename
 * only because the bundle identifier moved at the same time: whatever was
 * written under the old key belongs to the old app's container, which this
 * build cannot reach anyway. Renaming it on its own would strand every entry
 * on the device behind a key nothing reads.
 */
export const ENTRY_KEY_PREFIX = 'vidlun.entry.';

/**
 * One key per entry rather than one blob for all of them: saving an entry then
 * never rewrites the rest, so a crash mid-save cannot cost the user a journal.
 */
export class AsyncStorageMoodEntryRepository implements IMoodEntryRepository {
  constructor(private readonly store: IKeyValueStore) {}

  /**
   * The whole journal, kept after the first read and dropped on any write.
   * Opening the statistics screen reads the journal five times over —
   * summary, themes, patterns, the week before, the narrative — and each
   * read was a full AsyncStorage scan with a JSON.parse per entry. Nothing
   * else writes this store, so a write of our own is the only thing that
   * can date the copy.
   */
  private cache: readonly MoodEntry[] | null = null;

  async save(entry: MoodEntry): Promise<void> {
    this.cache = null;
    await this.store.setItem(keyFor(entry.id), JSON.stringify(toStored(entry)));
  }

  async delete(id: string): Promise<void> {
    this.cache = null;
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

  findAll(): Promise<readonly MoodEntry[]> {
    return this.readAll();
  }

  /** Newest first. */
  private async readAll(): Promise<readonly MoodEntry[]> {
    if (this.cache !== null) {
      return this.cache;
    }

    const keys = (await this.store.getAllKeys()).filter((key) => key.startsWith(ENTRY_KEY_PREFIX));
    const stored = keys.length === 0 ? [] : await this.store.multiGet(keys);

    this.cache = stored
      .map(([, value]) => readEntry(value))
      .filter((entry): entry is MoodEntry => entry !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return this.cache;
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
