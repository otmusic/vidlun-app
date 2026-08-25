import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import {
  SPEECH_MODEL,
  SpeechModelStore,
  type ModelStorage,
} from '@/infrastructure/transcription/SpeechModelStore';

const WHOLE = SPEECH_MODEL.leastPlausibleBytes + 1;
const PARTIAL_NAME = `${SPEECH_MODEL.fileName}.part`;

class FakeStorage implements ModelStorage {
  files = new Map<string, number>();
  removed: string[] = [];
  /** Bytes the next download writes before it settles. */
  arriving = WHOLE;
  failure: Error | null = null;
  onDownload: (() => void) | null = null;

  sizeOf(name: string): Promise<number | null> {
    return Promise.resolve(this.files.get(name) ?? null);
  }

  download(
    _url: string,
    name: string,
    onProgress: (writtenBytes: number, totalBytes: number | null) => void,
  ): Promise<void> {
    this.onDownload?.();
    onProgress(this.arriving / 2, this.arriving);

    if (this.failure !== null) {
      return Promise.reject(this.failure);
    }

    this.files.set(name, this.arriving);
    onProgress(this.arriving, this.arriving);

    return Promise.resolve();
  }

  rename(from: string, to: string): Promise<void> {
    const size = this.files.get(from);

    if (size !== undefined) {
      this.files.delete(from);
      this.files.set(to, size);
    }

    return Promise.resolve();
  }

  remove(name: string): Promise<void> {
    this.removed.push(name);
    this.files.delete(name);

    return Promise.resolve();
  }

  uriFor(name: string): string {
    return `file:///models/${name}`;
  }
}

function setup() {
  const storage = new FakeStorage();

  return { storage, subject: new SpeechModelStore(storage) };
}

describe('knowing whether the model is there', () => {
  it('reports absent on a fresh install', async () => {
    const { subject } = setup();

    expect(await subject.state()).toEqual({ kind: 'absent' });
  });

  it('reports ready once the whole file is in place', async () => {
    const { storage, subject } = setup();
    storage.files.set(SPEECH_MODEL.fileName, WHOLE);

    expect(await subject.state()).toEqual({
      kind: 'ready',
      uri: `file:///models/${SPEECH_MODEL.fileName}`,
    });
  });

  it('refuses to call a short file the model', async () => {
    const { storage, subject } = setup();
    storage.files.set(SPEECH_MODEL.fileName, 4_096);

    expect(await subject.state()).toEqual({ kind: 'absent' });
  });
});

describe('fetching it', () => {
  it('lands the model and reports where it is', async () => {
    const { subject } = setup();

    expect(await subject.fetch()).toEqual({
      kind: 'ready',
      uri: `file:///models/${SPEECH_MODEL.fileName}`,
    });
  });

  it('never names a file the model until it is whole', async () => {
    const { storage, subject } = setup();
    const namesDuringDownload: string[] = [];
    storage.onDownload = () => namesDuringDownload.push(...storage.files.keys());

    await subject.fetch();

    expect(namesDuringDownload).not.toContain(SPEECH_MODEL.fileName);
    expect(storage.files.has(SPEECH_MODEL.fileName)).toBe(true);
  });

  it('reports progress while it runs', async () => {
    const { subject } = setup();
    const seen: SpeechModelState[] = [];

    await subject.fetch((state) => seen.push(state));

    expect(seen).toEqual([
      { kind: 'fetching', writtenBytes: WHOLE / 2, totalBytes: WHOLE },
      { kind: 'fetching', writtenBytes: WHOLE, totalBytes: WHOLE },
    ]);
  });

  it('does nothing when the model is already there', async () => {
    const { storage, subject } = setup();
    storage.files.set(SPEECH_MODEL.fileName, WHOLE);
    let downloads = 0;
    storage.onDownload = () => (downloads += 1);

    await subject.fetch();

    expect(downloads).toBe(0);
  });

  it('throws away what arrived when the connection drops', async () => {
    const { storage, subject } = setup();
    storage.failure = new Error('offline');

    expect(await subject.fetch()).toEqual({ kind: 'failed', reason: 'unreachable' });
    expect(storage.files.has(SPEECH_MODEL.fileName)).toBe(false);
    expect(storage.removed).toContain(PARTIAL_NAME);
  });

  it('rejects a download that finished too small to be weights', async () => {
    const { storage, subject } = setup();
    storage.arriving = 8_192;

    expect(await subject.fetch()).toEqual({ kind: 'failed', reason: 'truncated' });
    expect(storage.files.has(SPEECH_MODEL.fileName)).toBe(false);
  });

  it('clears a leftover part file rather than resuming into it', async () => {
    const { storage, subject } = setup();
    storage.files.set(PARTIAL_NAME, 120_000_000);

    await subject.fetch();

    expect(storage.removed).toContain(PARTIAL_NAME);
  });

  it('joins a download already running instead of starting a second', async () => {
    const { storage, subject } = setup();
    let downloads = 0;
    storage.onDownload = () => (downloads += 1);

    const [first, second] = await Promise.all([subject.fetch(), subject.fetch()]);

    expect(downloads).toBe(1);
    expect(first).toEqual(second);
  });

  it('can be retried after a failure', async () => {
    const { storage, subject } = setup();
    storage.failure = new Error('offline');
    await subject.fetch();

    storage.failure = null;

    expect((await subject.fetch()).kind).toBe('ready');
  });
});
