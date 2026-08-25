import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

/**
 * Interchangeable with the stored implementation in every test, and the
 * fixture the app runs on before persistence exists.
 */
export class InMemoryMoodEntryRepository implements IMoodEntryRepository {
  private readonly entriesById = new Map<string, MoodEntry>();

  save(entry: MoodEntry): Promise<void> {
    this.entriesById.set(entry.id, entry);

    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.entriesById.delete(id);

    return Promise.resolve();
  }

  findById(id: string): Promise<MoodEntry | null> {
    return Promise.resolve(this.entriesById.get(id) ?? null);
  }

  findBetween(from: Date, to: Date): Promise<readonly MoodEntry[]> {
    const within = this.newestFirst().filter(
      (entry) => entry.createdAt >= from && entry.createdAt < to,
    );

    return Promise.resolve(within);
  }

  findRecent(limit: number): Promise<readonly MoodEntry[]> {
    return Promise.resolve(this.newestFirst().slice(0, limit));
  }

  private newestFirst(): MoodEntry[] {
    return [...this.entriesById.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
