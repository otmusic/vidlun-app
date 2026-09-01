import type { IJournalCodec } from '../../domain/ports/IJournalCodec';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

export interface ImportOutcome {
  /** Entries the journal did not have and now does. */
  readonly imported: number;
  /** Entries the file held that were already here, left untouched. */
  readonly skipped: number;
}

/**
 * A backup coming home.
 *
 * A merge, never a replace: whatever this phone already holds stays exactly
 * as it is, and only entries it has never seen come in. Restoring the same
 * file twice is therefore harmless — the second run imports nothing — and a
 * backup from an old phone can land on top of a journal already begun on a
 * new one without eating it.
 *
 * The codec has already refused any file that is not wholly readable, so by
 * the time entries reach the loop, every one of them is sound.
 */
export class ImportJournal {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly codec: IJournalCodec,
  ) {}

  async execute(json: string): Promise<ImportOutcome> {
    const entries = this.codec.decode(json);
    let imported = 0;
    let skipped = 0;

    for (const entry of entries) {
      if ((await this.repository.findById(entry.id)) === null) {
        await this.repository.save(entry);
        imported += 1;
      } else {
        skipped += 1;
      }
    }

    return { imported, skipped };
  }
}
