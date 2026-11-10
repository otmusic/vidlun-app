import type { KeptAffirmation } from '../../domain/entities/KeptAffirmation';
import type { AffirmationFrequency } from '../../domain/ports/IAffirmationReminders';
import type { IKeptAffirmations } from '../../domain/ports/IKeptAffirmations';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.keptAffirmation';

/** One record, the last pick; dates as ISO strings. */
export class AsyncStorageKeptAffirmations implements IKeptAffirmations {
  constructor(private readonly store: IKeyValueStore) {}

  async read(): Promise<KeptAffirmation | null> {
    const raw = await this.store.getItem(KEY);

    if (raw === null) {
      return null;
    }

    try {
      return parse(JSON.parse(raw));
    } catch {
      // A damaged record only means five to pick from again.
      return null;
    }
  }

  async write(kept: KeptAffirmation): Promise<void> {
    await this.store.setItem(
      KEY,
      JSON.stringify({
        ...kept,
        pickedAt: kept.pickedAt.toISOString(),
        until: kept.until.toISOString(),
      }),
    );
  }
}

function parse(value: unknown): KeptAffirmation | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const look = record['look'];
  const frequency = record['frequency'];
  const pickedAt = dateOf(record['pickedAt']);
  const until = dateOf(record['until']);

  if (
    typeof record['key'] !== 'string' ||
    typeof record['text'] !== 'string' ||
    !isFrequency(frequency) ||
    pickedAt === null ||
    until === null ||
    typeof look !== 'object' ||
    look === null
  ) {
    return null;
  }

  const drawn = look as Record<string, unknown>;

  if (
    typeof drawn['shape'] !== 'string' ||
    typeof drawn['tint'] !== 'number' ||
    typeof drawn['glyph'] !== 'string'
  ) {
    return null;
  }

  return {
    key: record['key'],
    text: record['text'],
    look: { shape: drawn['shape'], tint: drawn['tint'], glyph: drawn['glyph'] },
    frequency,
    pickedAt,
    until,
  };
}

function isFrequency(value: unknown): value is AffirmationFrequency {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function dateOf(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
