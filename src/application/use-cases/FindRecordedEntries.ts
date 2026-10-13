import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

/**
 * Which entries still have their audio, for the journal's cards to say so
 * (owner's word, 2026-10-13).
 *
 * Read from the files rather than from `source`: a voice entry loses its audio
 * after thirteen months, or never kept it when recordings were switched off,
 * and a card that promised a voice the entry no longer has would be wrong.
 */
export class FindRecordedEntries {
  constructor(private readonly recordings: IRecordingStore) {}

  execute(): Promise<ReadonlySet<string>> {
    return this.recordings.withAudio();
  }
}
