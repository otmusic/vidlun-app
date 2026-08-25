import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

/**
 * Where an entry's audio is, if it still has any.
 *
 * Null covers three cases the screen treats alike: the entry was typed, it was
 * recorded before recordings were kept, or its year has passed. None of them
 * is a failure, and none needs explaining differently.
 */
export class FindRecording {
  constructor(private readonly recordings: IRecordingStore) {}

  execute(entryId: string): Promise<string | null> {
    return this.recordings.find(entryId);
  }
}
