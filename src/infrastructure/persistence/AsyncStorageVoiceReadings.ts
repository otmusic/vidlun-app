import type { IVoiceReadings } from '../../domain/ports/IVoiceReadings';
import { VoiceReading } from '../../domain/value-objects/VoiceReading';
import type { IKeyValueStore } from './IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
const KEY = 'vidlun.voiceReadings';

/**
 * Every reading as one JSON object keyed by entry id — a few hundred bytes an
 * entry, so years of them stay small. Reads and writes take turns so a
 * reading saved while another is forgotten is not lost between the two.
 */
export class AsyncStorageVoiceReadings implements IVoiceReadings {
  private turn: Promise<unknown> = Promise.resolve();

  constructor(private readonly store: IKeyValueStore) {}

  save(entryId: string, reading: VoiceReading): Promise<void> {
    return this.change((all) => ({ ...all, [entryId]: reading.toJSON() }));
  }

  async find(entryId: string): Promise<VoiceReading | null> {
    return (await this.all()).get(entryId) ?? null;
  }

  async all(): Promise<ReadonlyMap<string, VoiceReading>> {
    const readings = new Map<string, VoiceReading>();

    for (const [id, raw] of Object.entries(await this.raw())) {
      const reading = VoiceReading.from(raw);

      if (reading !== null) {
        readings.set(id, reading);
      }
    }

    return readings;
  }

  forget(entryId: string): Promise<void> {
    return this.change((all) =>
      Object.fromEntries(Object.entries(all).filter(([id]) => id !== entryId)),
    );
  }

  clear(): Promise<void> {
    return this.change(() => ({}));
  }

  private async raw(): Promise<Record<string, unknown>> {
    const text = await this.store.getItem(KEY);

    if (text === null) {
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(text);

      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private change(edit: (all: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
    const work = async (): Promise<void> => {
      const edited = edit(await this.raw());

      if (Object.keys(edited).length === 0) {
        await this.store.removeItem(KEY);
      } else {
        await this.store.setItem(KEY, JSON.stringify(edited));
      }
    };
    const result = this.turn.then(work, work);

    this.turn = result.catch(() => undefined);

    return result;
  }
}
