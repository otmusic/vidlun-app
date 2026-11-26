import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { AsyncStorageMoodEntryRepository } from '@/infrastructure/persistence/AsyncStorageMoodEntryRepository';

import { InMemoryKeyValueStore } from './fakes';

/** Counts full scans, and can hold one open so a write lands in the middle of it. */
class CountingStore extends InMemoryKeyValueStore {
  scans = 0;
  private held: Promise<void> | null = null;
  private release: () => void = () => undefined;

  holdNextScan(): void {
    this.held = new Promise((resolve) => {
      this.release = resolve;
    });
  }

  letScanFinish(): void {
    this.release();
  }

  override async getAllKeys(): Promise<readonly string[]> {
    this.scans += 1;

    const keys = await super.getAllKeys();

    if (this.held !== null) {
      const held = this.held;

      this.held = null;
      await held;
    }

    return keys;
  }
}

function entry(id: string, day: number): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(2026, 10, day, 9, 0),
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: `Day ${day}.`,
    mood: MoodScore.of(3),
    emotionIds: [],
    contextTags: [],
    confidence: Confidence.of(0.9),
  });
}

describe('the journal kept in memory between reads', () => {
  it('keeps its copy through a save and a delete instead of reading everything again', async () => {
    const store = new CountingStore();
    const repository = new AsyncStorageMoodEntryRepository(store);

    await repository.save(entry('a', 1));
    await repository.findAll();
    await repository.save(entry('b', 3));
    await repository.save(entry('a', 2));
    await repository.delete('missing');

    const ids = (await repository.findAll()).map((kept) => kept.id);

    expect(ids).toEqual(['b', 'a']);
    expect(store.scans).toBe(1);
  });

  it('serves reads asked at the same time from one scan', async () => {
    const store = new CountingStore();
    const repository = new AsyncStorageMoodEntryRepository(store);

    await repository.save(entry('x', 1));
    await Promise.all([repository.findAll(), repository.findRecent(3), repository.findAll()]);

    expect(store.scans).toBe(1);
  });

  it('does not keep a scan that a save overtook', async () => {
    const store = new CountingStore();
    const repository = new AsyncStorageMoodEntryRepository(store);

    await repository.save(entry('a', 1));
    store.holdNextScan();

    const early = repository.findAll();

    await repository.save(entry('b', 2));
    store.letScanFinish();
    await early;

    const ids = (await repository.findAll()).map((kept) => kept.id);

    expect(ids).toEqual(['b', 'a']);
  });
});
