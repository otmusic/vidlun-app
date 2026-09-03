import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import {
  SPEECH_MODEL,
  SpeechModelStore,
  type ModelDownload,
  type ModelStorage,
  type Progress,
} from '@/infrastructure/transcription/SpeechModelStore';

const WHOLE = SPEECH_MODEL.leastPlausibleBytes + 1;
const PARTIAL_NAME = `${SPEECH_MODEL.fileName}.part`;
const PAUSE_NOTE = `${SPEECH_MODEL.fileName}.paused`;

/** A download the test settles by hand: completes, pauses, or drops. */
class ScriptedDownload implements ModelDownload {
  private settle!: (outcome: 'completed' | 'paused') => void;
  private drop!: (error: Error) => void;
  readonly done: Promise<'completed' | 'paused'>;
  paused = false;

  constructor(
    private readonly storage: FakeStorage,
    private readonly name: string,
    private readonly onProgress: Progress,
    private readonly resumedFrom: number,
  ) {
    this.done = new Promise((resolve, reject) => {
      this.settle = resolve;
      this.drop = reject;
    });
  }

  arrive(bytes: number): void {
    this.onProgress(this.resumedFrom + bytes, WHOLE);
  }

  complete(bytes = WHOLE): void {
    this.storage.files.set(this.name, bytes);
    this.onProgress(bytes, WHOLE);
    this.settle('completed');
  }

  fail(): void {
    this.drop(new Error('offline'));
  }

  pause(): Promise<string | null> {
    this.paused = true;
    this.settle('paused');

    return Promise.resolve(this.storage.pauseYields);
  }
}

class FakeStorage implements ModelStorage {
  files = new Map<string, number>();
  notes = new Map<string, string>();
  removed: string[] = [];
  started: string[] = [];
  resumed: string[] = [];
  downloads: ScriptedDownload[] = [];
  /** What a pause hands back; null models a platform with nothing to give. */
  pauseYields: string | null = '{"resumeData":"opaque"}';
  /** Whether the next download finishes on its own, as the simple tests want. */
  autoComplete = true;
  arriving = WHOLE;

  sizeOf(name: string): Promise<number | null> {
    return Promise.resolve(this.files.get(name) ?? null);
  }

  startDownload(_url: string, name: string, onProgress: Progress): ModelDownload {
    this.started.push(name);

    return this.script(name, onProgress, 0);
  }

  resumeDownload(saved: string, onProgress: Progress): ModelDownload {
    this.resumed.push(saved);

    return this.script(PARTIAL_NAME, onProgress, 120_000_000);
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
    this.notes.delete(name);

    return Promise.resolve();
  }

  uriFor(name: string): string {
    return `file:///models/${name}`;
  }

  writeNote(name: string, text: string): Promise<void> {
    this.notes.set(name, text);

    return Promise.resolve();
  }

  readNote(name: string): Promise<string | null> {
    return Promise.resolve(this.notes.get(name) ?? null);
  }

  private script(name: string, onProgress: Progress, resumedFrom: number): ScriptedDownload {
    const download = new ScriptedDownload(this, name, onProgress, resumedFrom);

    this.downloads.push(download);

    if (this.autoComplete) {
      download.arrive(this.arriving / 2);
      download.complete(this.arriving);
    }

    return download;
  }
}

function setup() {
  const storage = new FakeStorage();

  return { storage, subject: new SpeechModelStore(storage) };
}

/** Lets the store's own awaits run up to the point where the download is in hand. */
function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
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
    storage.autoComplete = false;

    const fetching = subject.fetch();
    await settle();
    const namesDuringDownload = [...storage.files.keys()];
    storage.downloads[0]?.complete();
    await fetching;

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

    await subject.fetch();

    expect(storage.started).toEqual([]);
  });

  it('throws away what arrived when the connection drops', async () => {
    const { storage, subject } = setup();
    storage.autoComplete = false;

    const fetching = subject.fetch();
    await settle();
    storage.downloads[0]?.fail();

    expect(await fetching).toEqual({ kind: 'failed', reason: 'unreachable' });
    expect(storage.files.has(SPEECH_MODEL.fileName)).toBe(false);
    expect(storage.removed).toContain(PARTIAL_NAME);
  });

  it('rejects a download that finished too small to be weights', async () => {
    const { storage, subject } = setup();
    storage.arriving = 8_192;

    expect(await subject.fetch()).toEqual({ kind: 'failed', reason: 'truncated' });
    expect(storage.files.has(SPEECH_MODEL.fileName)).toBe(false);
  });

  it('clears a part file nothing can continue from rather than trusting it', async () => {
    const { storage, subject } = setup();
    storage.files.set(PARTIAL_NAME, 120_000_000);

    await subject.fetch();

    expect(storage.removed).toContain(PARTIAL_NAME);
    expect(storage.started).toEqual([PARTIAL_NAME]);
  });

  it('joins a download already running instead of starting a second', async () => {
    const { storage, subject } = setup();

    const [first, second] = await Promise.all([subject.fetch(), subject.fetch()]);

    expect(storage.started).toHaveLength(1);
    expect(first).toEqual(second);
  });

  it('can be retried after a failure', async () => {
    const { storage, subject } = setup();
    storage.autoComplete = false;
    const failing = subject.fetch();
    await settle();
    storage.downloads[0]?.fail();
    await failing;

    storage.autoComplete = true;

    expect((await subject.fetch()).kind).toBe('ready');
  });
});

describe('pausing and continuing across launches', () => {
  it('keeps what the platform hands back at the pause', async () => {
    const { storage, subject } = setup();
    storage.autoComplete = false;

    const fetching = subject.fetch();
    await settle();
    storage.downloads[0]?.arrive(120_000_000);
    const removedBeforePause = [...storage.removed];
    await subject.pause();

    // Not an outcome: where things stand, so the screen keeps its number.
    expect(await fetching).toEqual({
      kind: 'fetching',
      writtenBytes: 120_000_000,
      totalBytes: WHOLE,
    });
    expect(storage.notes.get(PAUSE_NOTE)).toBe('{"resumeData":"opaque"}');
    // Nothing is cleaned up on a pause: what is on disk is what continues.
    expect(storage.removed).toEqual(removedBeforePause);
  });

  it('continues from the pause on the next fetch, in this launch or a later one', async () => {
    const { storage, subject } = setup();
    storage.notes.set(PAUSE_NOTE, '{"resumeData":"opaque"}');

    expect((await subject.fetch()).kind).toBe('ready');
    expect(storage.resumed).toEqual(['{"resumeData":"opaque"}']);
    expect(storage.started).toEqual([]);
  });

  it('counts what was already down into the progress it reports', async () => {
    const { storage, subject } = setup();
    storage.notes.set(PAUSE_NOTE, '{"resumeData":"opaque"}');
    storage.autoComplete = false;
    const seen: SpeechModelState[] = [];

    const fetching = subject.fetch((state) => seen.push(state));
    await settle();
    storage.downloads[0]?.arrive(10_000_000);
    storage.downloads[0]?.complete();
    await fetching;

    // The platform reports the running total, so the number on screen never
    // falls back below where the last launch left it.
    expect(seen[0]).toEqual({ kind: 'fetching', writtenBytes: 130_000_000, totalBytes: WHOLE });
  });

  it('uses the pause state once, so a resume that drops starts over next time', async () => {
    const { storage, subject } = setup();
    storage.notes.set(PAUSE_NOTE, '{"resumeData":"opaque"}');
    storage.autoComplete = false;

    const fetching = subject.fetch();
    await settle();
    storage.downloads[0]?.fail();
    await fetching;
    storage.autoComplete = true;
    await subject.fetch();

    expect(storage.resumed).toHaveLength(1);
    expect(storage.started).toEqual([PARTIAL_NAME]);
  });

  it('starts over when the platform had nothing to hand back at the pause', async () => {
    const { storage, subject } = setup();
    storage.autoComplete = false;
    storage.pauseYields = null;

    const fetching = subject.fetch();
    await settle();
    await subject.pause();
    await fetching;
    storage.autoComplete = true;
    await subject.fetch();

    expect(storage.notes.has(PAUSE_NOTE)).toBe(false);
    expect(storage.started).toEqual([PARTIAL_NAME, PARTIAL_NAME]);
  });

  it('pausing with nothing running is not an error', async () => {
    const { storage, subject } = setup();

    await expect(subject.pause()).resolves.toBeUndefined();
    expect(storage.notes.size).toBe(0);
  });

  it('forgets the pause once the model is whole', async () => {
    const { storage, subject } = setup();
    storage.notes.set(PAUSE_NOTE, '{"resumeData":"opaque"}');

    await subject.fetch();

    expect(storage.notes.has(PAUSE_NOTE)).toBe(false);
  });
});
