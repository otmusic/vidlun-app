import { Directory, File, Paths } from 'expo-file-system';

import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

/**
 * Documents, not cache. iOS empties the cache under storage pressure, and a
 * voice that quietly disappeared between sessions would be worse than one that
 * was never kept — the person would have no way to know it had gone.
 */
const RECORDINGS = 'recordings';

/**
 * Cache, on purpose: a voice held for the seconds a deletion can be undone
 * (owner's word, 2026-11-19) must not outlive them. Whatever is left here
 * when the app closes in between goes with the cache at the next launch.
 */
export const HELD_VOICES = 'held-voices';

/**
 * Kept as AAC since 2026-11-18 (owner's word): about a sixth of the WAV the
 * recorder writes, which matters now that nothing removes a voice but the
 * person. A take arrives as WAV — the speech model needs it that way — and is
 * compressed after its entry is saved; until then, and wherever compressing
 * is not possible, the WAV is what is kept.
 */
const COMPACT = '.m4a';
const RAW = '.wav';
/** Where a compression writes before the result takes the recording's name. */
const PARTIAL = '.partial.m4a';
/** Only names this store writes count as an entry's recording. */
const KEPT = /^([A-Za-z0-9_-]+)\.(m4a|wav)$/;

/** The native compressor; see `modules/vidlun-backup`. Null where it was not built in. */
export interface AudioCompressor {
  compressAudio(source: string, target: string): Promise<void>;
}

export class FileRecordingStore implements IRecordingStore {
  private readonly directory = new Directory(Paths.document, RECORDINGS);
  /** The compaction running now, so a second call joins it instead of racing it. */
  private compacting: Promise<void> | null = null;

  constructor(private readonly compressor: AudioCompressor | null) {}

  async keep(entryId: string, sourceUri: string): Promise<void> {
    this.ensureDirectory();

    const source = new File(sourceUri);

    // Moved rather than copied: the take is in the recorder's scratch space,
    // which is cleared without warning, and two copies of a recording serve
    // nobody. A compact file (from a backup) is kept as it came.
    if (source.name.endsWith(COMPACT)) {
      removeIfThere(this.fileFor(entryId, COMPACT));
      await source.move(this.fileFor(entryId, COMPACT));

      return;
    }

    await source.move(this.fileFor(entryId, RAW));

    // Not awaited: the entry is saved, and its voice gets smaller behind it.
    void this.compact();
  }

  compact(): Promise<void> {
    if (this.compressor === null || !this.directory.exists) {
      return Promise.resolve();
    }

    this.compacting ??= this.compactAll(this.compressor).finally(() => {
      this.compacting = null;
    });

    return this.compacting;
  }

  discard(entryId: string): Promise<void> {
    for (const extension of [COMPACT, RAW, PARTIAL]) {
      removeIfThere(this.fileFor(entryId, extension));
    }

    return Promise.resolve();
  }

  async setAside(entryId: string): Promise<string | null> {
    // A compression half done for this voice is of no use to anyone now.
    removeIfThere(this.fileFor(entryId, PARTIAL));

    const kept = await this.find(entryId);

    if (kept === null) {
      return null;
    }

    const held = new Directory(Paths.cache, HELD_VOICES);

    if (!held.exists) {
      held.create({ intermediates: true });
    }

    const source = new File(kept);
    const target = new File(held, source.name);

    removeIfThere(target);
    await source.move(target);

    return target.uri;
  }

  release(heldUri: string): Promise<void> {
    removeIfThere(new File(heldUri));

    return Promise.resolve();
  }

  discardBefore(cutoff: Date): Promise<void> {
    if (!this.directory.exists) {
      return Promise.resolve();
    }

    for (const item of this.directory.list()) {
      const at = item instanceof File ? item.modificationTime : null;

      if (at !== null && at !== undefined && new Date(at * 1000) < cutoff) {
        item.delete();
      }
    }

    return Promise.resolve();
  }

  find(entryId: string): Promise<string | null> {
    const compact = this.fileFor(entryId, COMPACT);

    if (compact.exists) {
      return Promise.resolve(compact.uri);
    }

    const raw = this.fileFor(entryId, RAW);

    return Promise.resolve(raw.exists ? raw.uri : null);
  }

  withAudio(): Promise<ReadonlySet<string>> {
    if (!this.directory.exists) {
      return Promise.resolve(new Set());
    }

    const ids = this.directory.list().flatMap((item) => {
      const match = item instanceof File ? KEPT.exec(item.name) : null;

      return match?.[1] === undefined ? [] : [match[1]];
    });

    return Promise.resolve(new Set(ids));
  }

  /**
   * One WAV at a time into AAC beside it, then the AAC takes the recording's
   * name and the WAV goes. A WAV deleted meanwhile — its entry deleted —
   * leaves nothing behind; a WAV that will not convert is left as it is.
   */
  private async compactAll(compressor: AudioCompressor): Promise<void> {
    const raw = this.directory
      .list()
      .filter((item): item is File => item instanceof File && KEPT.exec(item.name)?.[2] === 'wav');

    for (const wav of raw) {
      const entryId = wav.name.slice(0, -RAW.length);
      const partial = this.fileFor(entryId, PARTIAL);

      try {
        removeIfThere(partial);
        await compressor.compressAudio(wav.uri, partial.uri);

        if (!wav.exists) {
          removeIfThere(partial);
          continue;
        }

        removeIfThere(this.fileFor(entryId, COMPACT));
        await partial.move(this.fileFor(entryId, COMPACT));
        wav.delete();
      } catch {
        removeIfThere(partial);
      }
    }
  }

  private fileFor(entryId: string, extension: string): File {
    return new File(this.directory, `${entryId}${extension}`);
  }

  private ensureDirectory(): void {
    if (!this.directory.exists) {
      this.directory.create({ intermediates: true });
    }
  }
}

function removeIfThere(file: File): void {
  if (file.exists) {
    file.delete();
  }
}
