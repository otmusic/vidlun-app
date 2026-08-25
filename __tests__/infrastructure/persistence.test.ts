import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import {
  AsyncStorageMoodEntryRepository,
  ENTRY_KEY_PREFIX,
} from '@/infrastructure/persistence/AsyncStorageMoodEntryRepository';
import { AsyncStorageRevisionLog } from '@/infrastructure/persistence/AsyncStorageRevisionLog';
import {
  CorruptStoredEntryError,
  fromStored,
  toStored,
} from '@/infrastructure/persistence/moodEntryMapper';
import { InMemoryKeyValueStore } from './fakes';

const CREATED_AT = new Date('2026-07-31T18:00:00.000Z');

function entry(overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: CREATED_AT,
    source: 'voice',
    rawTranscript: 'raw words',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud', 'bad.tired'],
    contextTags: ['work'],
    observation: 'Sounds like the good kind of tired.',
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

describe('mood entry mapper', () => {
  it('round-trips an entry through storage without losing a field', () => {
    const original = entry();

    expect(fromStored(toStored(original)).toProps()).toEqual(original.toProps());
  });

  it('round-trips the fields that are easy to drop', () => {
    const original = entry({ safetyFlag: 'distress', wasRevisedByUser: true, contextTags: [] });
    const restored = fromStored(toStored(original));

    expect(restored.safetyFlag).toBe('distress');
    expect(restored.wasRevisedByUser).toBe(true);
    expect(restored.contextTags).toEqual([]);
  });

  it('keeps the proposal and the correction apart across a save and a load', () => {
    const corrected = entry().reviseWith({ emotionIds: ['sad.lonely'] });
    const restored = fromStored(toStored(corrected));

    expect(restored.emotionIds).toEqual(['sad.lonely']);
    expect(restored.proposedEmotionIds).toEqual(['happy.proud', 'bad.tired']);
  });

  it('reads a record written before the proposal had its own field', () => {
    const legacy: Record<string, unknown> = { ...toStored(entry()) };
    delete legacy.proposedEmotionIds;

    expect(fromStored(legacy).proposedEmotionIds).toEqual(['happy.proud', 'bad.tired']);
  });

  it('still refuses a stored proposal that is not a list of strings', () => {
    expect(() => fromStored({ ...toStored(entry()), proposedEmotionIds: [7] })).toThrow(
      CorruptStoredEntryError,
    );
  });

  it.each([
    ['not an object', 42],
    ['an array', []],
    ['null', null],
  ])('refuses a stored record that is %s', (_label, stored) => {
    expect(() => fromStored(stored)).toThrow(CorruptStoredEntryError);
  });

  it.each([
    'id',
    'createdAt',
    'source',
    'rawTranscript',
    'cleanTranscript',
    'mood',
    'emotionIds',
    'contextTags',
    'confidence',
    'safetyFlag',
    'wasRevisedByUser',
  ])('refuses a stored record missing "%s"', (field) => {
    const stored: Record<string, unknown> = { ...toStored(entry()) };

    delete stored[field];

    expect(() => fromStored(stored)).toThrow(CorruptStoredEntryError);
  });

  it('refuses an unparseable timestamp', () => {
    expect(() => fromStored({ ...toStored(entry()), createdAt: 'last tuesday' })).toThrow(
      CorruptStoredEntryError,
    );
  });

  it('refuses a value of the wrong type', () => {
    expect(() => fromStored({ ...toStored(entry()), mood: '4' })).toThrow(CorruptStoredEntryError);
    expect(() => fromStored({ ...toStored(entry()), emotionIds: [1, 2] })).toThrow(
      CorruptStoredEntryError,
    );
    expect(() => fromStored({ ...toStored(entry()), observation: 7 })).toThrow(
      CorruptStoredEntryError,
    );
    expect(() => fromStored({ ...toStored(entry()), source: 'telepathy' })).toThrow(
      CorruptStoredEntryError,
    );
  });

  it('reads a missing observation as no observation', () => {
    const stored: Record<string, unknown> = { ...toStored(entry()) };

    delete stored['observation'];

    expect(fromStored(stored).observation).toBeNull();
  });
});

describe('AsyncStorageMoodEntryRepository', () => {
  it('stores one key per entry so saving never rewrites the journal', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new AsyncStorageMoodEntryRepository(store);

    await repository.save(entry());
    await repository.save(entry({ id: 'entry-2' }));

    expect(await store.getAllKeys()).toEqual([
      `${ENTRY_KEY_PREFIX}entry-1`,
      `${ENTRY_KEY_PREFIX}entry-2`,
    ]);
  });

  it('reads back what it wrote', async () => {
    const repository = new AsyncStorageMoodEntryRepository(new InMemoryKeyValueStore());
    const saved = entry();

    await repository.save(saved);

    expect((await repository.findById('entry-1'))?.toProps()).toEqual(saved.toProps());
  });

  it('returns null for an entry it never stored', async () => {
    const repository = new AsyncStorageMoodEntryRepository(new InMemoryKeyValueStore());

    expect(await repository.findById('missing')).toBeNull();
  });

  it('skips one unreadable record instead of losing the whole journal', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new AsyncStorageMoodEntryRepository(store);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await repository.save(entry());
    store.poison(`${ENTRY_KEY_PREFIX}broken`, '{ not json');

    const found = await repository.findRecent(10);

    expect(found.map((each) => each.id)).toEqual(['entry-1']);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it('leaves the unreadable record on disk for a later version to rescue', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new AsyncStorageMoodEntryRepository(store);

    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.poison(`${ENTRY_KEY_PREFIX}broken`, '{ not json');

    await repository.findRecent(10);

    expect(await store.getItem(`${ENTRY_KEY_PREFIX}broken`)).toBe('{ not json');
  });

  it('ignores keys that belong to something else', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new AsyncStorageMoodEntryRepository(store);

    await store.setItem('luna.settings.theme', 'dark');
    await repository.save(entry());

    expect(await repository.findRecent(10)).toHaveLength(1);
  });

  it('orders and filters by date', async () => {
    const repository = new AsyncStorageMoodEntryRepository(new InMemoryKeyValueStore());
    const monday = new Date(2026, 6, 27, 8, 0);
    const friday = new Date(2026, 6, 31, 8, 0);

    await repository.save(entry({ id: 'monday', createdAt: monday }));
    await repository.save(entry({ id: 'friday', createdAt: friday }));

    expect((await repository.findRecent(10)).map((each) => each.id)).toEqual(['friday', 'monday']);
    expect((await repository.findBetween(monday, friday)).map((each) => each.id)).toEqual(['monday']);
  });

  it('removes an entry from disk', async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new AsyncStorageMoodEntryRepository(store);
    await repository.save(entry());

    await repository.delete('entry-1');

    expect(await repository.findById('entry-1')).toBeNull();
  });

  it('deletes an entry that was never stored without complaining', async () => {
    const repository = new AsyncStorageMoodEntryRepository(new InMemoryKeyValueStore());

    await expect(repository.delete('never-existed')).resolves.toBeUndefined();
  });

  it('reads an empty store without reaching for values', async () => {
    const repository = new AsyncStorageMoodEntryRepository(new InMemoryKeyValueStore());

    expect(await repository.findRecent(10)).toEqual([]);
    expect(await repository.findBetween(new Date(0), new Date())).toEqual([]);
  });
});

describe('AsyncStorageRevisionLog', () => {
  it('keeps every revision rather than overwriting the last one', async () => {
    const store = new InMemoryKeyValueStore();
    const log = new AsyncStorageRevisionLog(store);

    await log.record({
      entryId: 'entry-1',
      revisedAt: CREATED_AT,
      proposedMood: 4,
      finalMood: 5,
      proposedEmotionIds: ['happy.proud', 'bad.tired'],
      finalEmotionIds: ['happy.proud'],
    });
    await log.record({
      entryId: 'entry-1',
      revisedAt: new Date('2026-07-31T19:00:00.000Z'),
      proposedMood: 5,
      finalMood: 3,
      proposedEmotionIds: [],
      finalEmotionIds: ['sad'],
    });

    expect(await store.getAllKeys()).toHaveLength(2);
  });

  it('sweeps every revision an entry left behind, not just the last', async () => {
    const store = new InMemoryKeyValueStore();
    const log = new AsyncStorageRevisionLog(store);
    const revision = {
      entryId: 'entry-1',
      proposedMood: 4,
      finalMood: 5,
      proposedEmotionIds: ['happy.proud'],
      finalEmotionIds: ['happy'],
    };
    await log.record({ ...revision, revisedAt: new Date('2026-08-25T10:00:00.000Z') });
    await log.record({ ...revision, revisedAt: new Date('2026-08-25T11:00:00.000Z') });
    await log.record({ ...revision, entryId: 'entry-2', revisedAt: new Date('2026-08-25T12:00:00.000Z') });

    await log.forget('entry-1');

    const left = (await store.getAllKeys()).filter((k) => k.startsWith('luna.revision.'));

    expect(left).toHaveLength(1);
    expect(left[0]).toContain('entry-2');
  });

  it('writes the diff a future model would need to learn from', async () => {
    const store = new InMemoryKeyValueStore();

    await new AsyncStorageRevisionLog(store).record({
      entryId: 'entry-1',
      revisedAt: CREATED_AT,
      proposedMood: 4,
      finalMood: 5,
      proposedEmotionIds: ['happy.proud', 'bad.tired'],
      finalEmotionIds: ['happy.proud'],
    });

    const [key] = await store.getAllKeys();
    const raw = await store.getItem(key ?? '');

    expect(JSON.parse(raw ?? '')).toEqual({
      entryId: 'entry-1',
      revisedAt: CREATED_AT.toISOString(),
      proposedMood: 4,
      finalMood: 5,
      proposedEmotionIds: ['happy.proud', 'bad.tired'],
      finalEmotionIds: ['happy.proud'],
    });
  });
});
