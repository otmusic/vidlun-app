import { Directory, File, Paths } from 'expo-file-system';

import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

/**
 * Documents, not cache. iOS empties the cache under storage pressure, and a
 * voice that quietly disappeared between sessions would be worse than one that
 * was never kept — the person would have no way to know it had gone.
 */
const RECORDINGS = 'recordings';

/**
 * Kept as the WAV the recorder produced. Roughly 32 KB per second, so a year
 * of daily entries lands near 360 MB before the sweep starts reclaiming any.
 * Compressing is an optimisation for when that number matters; it would mean
 * adding something that transcodes, and the year bounds the total either way.
 */
const EXTENSION = '.wav';

export class FileRecordingStore implements IRecordingStore {
  private readonly directory = new Directory(Paths.document, RECORDINGS);

  async keep(entryId: string, sourceUri: string): Promise<void> {
    this.ensureDirectory();

    // Moved rather than copied: the take is in the recorder's scratch space,
    // which is cleared without warning, and two copies of a megabyte serve
    // nobody.
    await new File(sourceUri).move(this.fileFor(entryId));
  }

  discard(entryId: string): Promise<void> {
    const file = this.fileFor(entryId);

    if (file.exists) {
      file.delete();
    }

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
    const file = this.fileFor(entryId);

    return Promise.resolve(file.exists ? file.uri : null);
  }

  private fileFor(entryId: string): File {
    return new File(this.directory, `${entryId}${EXTENSION}`);
  }

  private ensureDirectory(): void {
    if (!this.directory.exists) {
      this.directory.create({ intermediates: true });
    }
  }
}
