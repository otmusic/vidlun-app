import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { DomainError } from '../../domain/errors/DomainError';
import type { IJournalCodec } from '../../domain/ports/IJournalCodec';

import { fromStored, toStored } from './moodEntryMapper';

/** Bumped when the stored shape changes; decode keeps reading older numbers. */
const FORMAT = 1;

export class UnreadableExportError extends DomainError {
  constructor(reason: string) {
    super(`This file is not a Vidlun export this app can read: ${reason}.`);
  }
}

/**
 * The export file is the repository's own stored shape in an envelope, so a
 * backup round-trips with nothing lost — including fields this screen never
 * shows, like the revision flag and the raw transcript.
 */
export class JournalCodec implements IJournalCodec {
  encode(entries: readonly MoodEntry[], exportedAt: Date): string {
    return `${JSON.stringify(
      {
        app: 'vidlun',
        format: FORMAT,
        exportedAt: exportedAt.toISOString(),
        entries: entries.map(toStored),
      },
      null,
      2,
    )}\n`;
  }

  decode(json: string): readonly MoodEntry[] {
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch {
      throw new UnreadableExportError('not JSON');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new UnreadableExportError('not an object');
    }

    const record = parsed as Record<string, unknown>;

    if (record['app'] !== 'vidlun') {
      throw new UnreadableExportError('made by another app');
    }

    if (typeof record['format'] !== 'number' || record['format'] > FORMAT) {
      throw new UnreadableExportError('written by a newer version of Vidlun');
    }

    if (!Array.isArray(record['entries'])) {
      throw new UnreadableExportError('it holds no entries');
    }

    // Strict per entry: one corrupt row refuses the file, because a backup
    // that silently restored half of a journal would be trusted and wrong.
    return record['entries'].map((entry: unknown) => fromStored(entry));
  }
}
