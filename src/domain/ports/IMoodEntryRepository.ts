import type { MoodEntry } from '../entities/MoodEntry';

export interface IMoodEntryRepository {
  save(entry: MoodEntry): Promise<void>;
  findById(id: string): Promise<MoodEntry | null>;
  /** `from` inclusive, `to` exclusive. Newest first. */
  findBetween(from: Date, to: Date): Promise<readonly MoodEntry[]>;
  findRecent(limit: number): Promise<readonly MoodEntry[]>;
}
