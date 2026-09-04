import type { IKeyValueStore } from '@/infrastructure/persistence/IKeyValueStore';
import { FileParkedTake, type ParkedFiles } from '@/infrastructure/persistence/FileParkedTake';

const SPOKEN_AT = new Date('2026-09-03T21:14:00.000Z');
const SCRATCH = 'file:///scratch/take-1.wav';
const KEPT = 'file:///documents/parked-take/take.wav';

class FakeKeyValueStore implements IKeyValueStore {
  readonly items = new Map<string, string>();

  getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.items.get(key) ?? null);
  }

  setItem(key: string, value: string): Promise<void> {
    this.items.set(key, value);

    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    this.items.delete(key);

    return Promise.resolve();
  }

  getAllKeys(): Promise<readonly string[]> {
    return Promise.resolve([...this.items.keys()]);
  }

  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]> {
    return Promise.resolve(keys.map((key) => [key, this.items.get(key) ?? null] as const));
  }
}

class FakeFiles implements ParkedFiles {
  kept: string | null = null;
  movedFrom: string[] = [];

  moveIn(sourceUri: string): Promise<void> {
    this.movedFrom.push(sourceUri);
    this.kept = sourceUri;

    return Promise.resolve();
  }

  present(): boolean {
    return this.kept !== null;
  }

  removeKept(): void {
    this.kept = null;
  }

  keptUri(): string {
    return KEPT;
  }
}

function setup() {
  const store = new FakeKeyValueStore();
  const files = new FakeFiles();

  return { store, files, subject: new FileParkedTake(store, files) };
}

describe('a take kept for a phone that cannot hear yet', () => {
  it('is nothing on a fresh install', async () => {
    const { subject } = setup();

    expect(await subject.parked()).toBeNull();
  });

  it('moves the take out of the recorder scratch space when parked', async () => {
    const { files, subject } = setup();

    await subject.park({ uri: SCRATCH, durationMs: 18_400 }, SPOKEN_AT);

    expect(files.movedFrom).toEqual([SCRATCH]);
    expect(await subject.parked()).toEqual({
      recording: { uri: KEPT, durationMs: 18_400 },
      recordedAt: SPOKEN_AT,
    });
  });

  it('is still there for a new instance, as after the app was ended', async () => {
    const { store, files, subject } = setup();
    await subject.park({ uri: SCRATCH, durationMs: 18_400 }, SPOKEN_AT);

    const later = new FileParkedTake(store, files);

    expect((await later.parked())?.recordedAt).toEqual(SPOKEN_AT);
  });

  it('keeps the later take, not both', async () => {
    const { files, subject } = setup();
    await subject.park({ uri: SCRATCH, durationMs: 18_400 }, SPOKEN_AT);

    await subject.park({ uri: 'file:///scratch/take-2.wav', durationMs: 5_000 }, SPOKEN_AT);

    expect(files.movedFrom).toHaveLength(2);
    expect((await subject.parked())?.recording.durationMs).toBe(5_000);
  });

  it('forgets a note whose file is gone rather than promising a take', async () => {
    const { files, subject } = setup();
    await subject.park({ uri: SCRATCH, durationMs: 18_400 }, SPOKEN_AT);
    files.kept = null;

    expect(await subject.parked()).toBeNull();
    // And the next read does not have to discover the same thing again.
    expect(await subject.parked()).toBeNull();
  });

  it('forgets a note it cannot read', async () => {
    const { store, files, subject } = setup();
    files.kept = KEPT;
    store.items.set('vidlun.parkedTake', 'not json');

    expect(await subject.parked()).toBeNull();
    expect(files.present()).toBe(false);
  });

  it('keeps the file when released: the recording is the entry\'s now', async () => {
    const { files, subject } = setup();
    await subject.park({ uri: SCRATCH, durationMs: 18_400 }, SPOKEN_AT);

    await subject.release();

    expect(await subject.parked()).toBeNull();
    expect(files.present()).toBe(true);
  });

  it('lets the next park replace a released file', async () => {
    const { files, subject } = setup();
    await subject.park({ uri: SCRATCH, durationMs: 18_400 }, SPOKEN_AT);
    await subject.release();

    await subject.park({ uri: 'file:///scratch/take-2.wav', durationMs: 5_000 }, SPOKEN_AT);

    expect(files.movedFrom).toHaveLength(2);
    expect((await subject.parked())?.recording.durationMs).toBe(5_000);
  });

  it('clears without complaint when nothing is parked', async () => {
    const { subject } = setup();

    await expect(subject.clear()).resolves.toBeUndefined();
  });

  it('is gone once cleared', async () => {
    const { files, subject } = setup();
    await subject.park({ uri: SCRATCH, durationMs: 18_400 }, SPOKEN_AT);

    await subject.clear();

    expect(await subject.parked()).toBeNull();
    expect(files.present()).toBe(false);
  });
});
