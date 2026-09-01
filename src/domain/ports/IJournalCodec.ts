import type { MoodEntry } from '../entities/MoodEntry';

/**
 * Turns the journal into a file a person owns, and back.
 *
 * A port because the file layout is a persistence concern — the same stored
 * shape the repository writes — and the use case must not know it. `decode`
 * is strict the way the repository is strict: a file that cannot be read in
 * full is refused whole rather than half-imported.
 */
export interface IJournalCodec {
  encode(entries: readonly MoodEntry[], exportedAt: Date): string;
  /** Throws on anything that is not a Vidlun export this build can read. */
  decode(json: string): readonly MoodEntry[];
}
