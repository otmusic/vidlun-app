import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

/**
 * Writes Vidlun's echo into an entry that was saved before the echo arrived.
 *
 * A named answer is saved the moment the person goes on (owner's word,
 * 2026-09-30), and the echo comes from a slower model a few seconds later.
 * It is folded in only where it still belongs: an entry that exists, has no
 * echo yet, and whose words were not changed since the echo was written
 * about them. A crisis entry never takes one — the entity refuses it.
 *
 * Hands back the entry as it now stands when the echo went in, and null when
 * nothing was written, so a page already open on the entry can catch up.
 */
export class AttachObservation {
  constructor(private readonly repository: IMoodEntryRepository) {}

  async execute(entryId: string, observation: string): Promise<MoodEntry | null> {
    const entry = await this.repository.findById(entryId);

    if (entry === null || entry.observation !== null || entry.wasRevisedByUser) {
      return null;
    }

    const echoed = entry.withObservation(observation);

    if (echoed.observation === null) {
      return null;
    }

    await this.repository.save(echoed);

    return echoed;
  }
}
