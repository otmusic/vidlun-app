import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

/**
 * Keeps the voice small on the phone (owner's word, 2026-11-18): any
 * recording still kept as WAV — every one made before this, and a new take
 * until the compression behind its save is done — becomes AAC. Runs when the
 * app opens; nothing waits on it, and a recording it cannot convert stays as
 * it was.
 */
export class CompactRecordings {
  constructor(private readonly recordings: IRecordingStore) {}

  execute(): Promise<void> {
    return this.recordings.compact();
  }
}
