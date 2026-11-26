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
   * The whole journal, kept after the first read. Opening the statistics
   * screen reads the journal five times over — summary, themes, patterns,
   * the week before, the narrative — and each read was a full AsyncStorage
   * scan with a JSON.parse per entry. Nothing else writes this store, so a
   * write of our own is the only thing that can date the copy, and a write
   * now changes the copy rather than throwing it away: dropping it cost the
   * next home view four full scans after every save, delete and undo
   * (performance review, 2026-11-26).
   */
  private cache: readonly MoodEntry[] | null = null;
  /** The full read under way, shared by everyone who asks while it runs. */
  private loading: Promise<readonly MoodEntry[]> | null = null;
  /** Counts writes, so a read that began before one never becomes the copy. */
  private writes = 0;

  async save(entry: MoodEntry): Promise<void> {
    this.wrote();
    await this.store.setItem(keyFor(entry.id), JSON.stringify(toStored(entry)));

    if (this.cache !== null) {
      this.cache = newestFirst([...this.cache.filter((kept) => kept.id !== entry.id), entry]);
    }
  }

  async delete(id: string): Promise<void> {
    this.wrote();
    await this.store.removeItem(keyFor(id));

    if (this.cache !== null) {
      this.cache = this.cache.filter((kept) => kept.id !== id);
    }
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

  /*
   * A read already under way when a write starts would hand its callers the
   * journal without that write; it finishes for whoever asked before, and
   * anyone asking after starts a read of their own.
   */
  private wrote(): void {
    this.writes += 1;
    this.loading = null;
  }

  /** Newest first. */
  private readAll(): Promise<readonly MoodEntry[]> {
    if (this.cache !== null) {
      return Promise.resolve(this.cache);
    }

    if (this.loading === null) {
      const loading = this.load().finally(() => {
        if (this.loading === loading) {
          this.loading = null;
        }
      });

      this.loading = loading;
    }

    return this.loading;
  }

  private async load(): Promise<readonly MoodEntry[]> {
    const startedAt = this.writes;
    const keys = (await this.store.getAllKeys()).filter((key) => key.startsWith(ENTRY_KEY_PREFIX));
    const stored = keys.length === 0 ? [] : await this.store.multiGet(keys);
    const entries = newestFirst(
      stored.map(([, value]) => readEntry(value)).filter((entry): entry is MoodEntry => entry !== null),
    );

    if (this.writes === startedAt) {
      this.cache = entries;
    }

    return entries;
  }
}

function newestFirst(entries: readonly MoodEntry[]): readonly MoodEntry[] {
  return [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
