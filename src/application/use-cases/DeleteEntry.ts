import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { IRevisionLog } from '../../domain/ports/IRevisionLog';

/**
 * Removes an entry and everything the app kept because of it.
 *
 * There is no undo and there should not be one: a journal that quietly holds
 * onto what you deleted is worse than one that loses it. That includes the
 * voice — leaving a recording behind after someone removed the entry it
 * belonged to is the kind of thing a journal never recovers from.
 */
export class DeleteEntry {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly revisionLog: IRevisionLog,
    private readonly recordings: IRecordingStore,
  ) {}

  async execute(id: string): Promise<void> {
    // The entry goes first. If forgetting the diff fails afterwards, the user
    // still sees the thing they asked to remove actually gone.
    await this.repository.delete(id);
    await this.revisionLog.forget(id);
    await this.recordings.discard(id);
  }
}
