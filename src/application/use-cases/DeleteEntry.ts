import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IRevisionLog } from '../../domain/ports/IRevisionLog';

/**
 * Removes an entry and everything the app kept because of it.
 *
 * There is no undo and there should not be one: a journal that quietly holds
 * onto what you deleted is worse than one that loses it. The recording will
 * be removed here too once recordings are kept — the whole reason this use
 * case exists before anyone asked for a delete button.
 */
export class DeleteEntry {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly revisionLog: IRevisionLog,
  ) {}

  async execute(id: string): Promise<void> {
    // The entry goes first. If forgetting the diff fails afterwards, the user
    // still sees the thing they asked to remove actually gone.
    await this.repository.delete(id);
    await this.revisionLog.forget(id);
  }
}
