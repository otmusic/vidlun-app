import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type { IParkedTake, ParkedTake } from '../../domain/ports/IParkedTake';
import type { IKeyValueStore } from './IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.parkedTake';

/** The filesystem, as much of it as parking one take needs. */
export interface ParkedFiles {
  /** Moves a take from wherever the recorder left it into the one kept slot. */
  moveIn(sourceUri: string): Promise<void>;
  /** Whether the kept slot holds a file. */
  present(): boolean;
  removeKept(): void;
  keptUri(): string;
}

interface Note {
  readonly durationMs: number;
  readonly recordedAt: string;
}

/**
 * The take goes to a durable slot the moment it is parked — the recorder's
 * scratch space is cleared without warning, and the whole point of parking
 * is that this recording outlives a download the app may not survive.
 */
export class FileParkedTake implements IParkedTake {
  constructor(
    private readonly store: IKeyValueStore,
    private readonly files: ParkedFiles,
  ) {}

  async park(recording: AudioRecording, recordedAt: Date): Promise<void> {
    // Whatever waited before is replaced: the newer take is the later word.
    this.files.removeKept();
    await this.files.moveIn(recording.uri);

    const note: Note = { durationMs: recording.durationMs, recordedAt: recordedAt.toISOString() };

    await this.store.setItem(KEY, JSON.stringify(note));
  }

  async parked(): Promise<ParkedTake | null> {
    const raw = await this.store.getItem(KEY);

    if (raw === null) {
      return null;
    }

    const note = readNote(raw);

    // A note without its file, or a file without a readable note, is nothing
    // to continue from; forgetting both is what makes the next park clean.
    if (note === null || !this.files.present()) {
      await this.clear();

      return null;
    }

    return {
      recording: { uri: this.files.keptUri(), durationMs: note.durationMs },
      recordedAt: new Date(note.recordedAt),
    };
  }

  async release(): Promise<void> {
    // The file stays where it is; the next park removes it before moving in.
    await this.store.removeItem(KEY);
  }

  async clear(): Promise<void> {
    this.files.removeKept();
    await this.store.removeItem(KEY);
  }
}

function readNote(raw: string): Note | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const { durationMs, recordedAt } = parsed as { durationMs?: unknown; recordedAt?: unknown };

    if (typeof durationMs !== 'number' || typeof recordedAt !== 'string') {
      return null;
    }

    return Number.isNaN(new Date(recordedAt).getTime()) ? null : { durationMs, recordedAt };
  } catch {
    return null;
  }
}
