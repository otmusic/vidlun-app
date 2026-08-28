import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

export interface SearchEntriesInput {
  /** Matched against the sentence. Empty means everything. */
  readonly query?: string;
  /** One emotion the entry must carry. Null means no narrowing. */
  readonly emotionId?: string | null;
}

export interface SearchResult {
  readonly entries: readonly MoodEntry[];
  /**
   * The words worth offering as filters — the ones this person actually uses,
   * most-used first. A fixed list would offer feelings nobody here has had.
   */
  readonly filterIds: readonly string[];
}

/** Five pills fit two rows beside the "all" one, and a third row is a form. */
const MOST_FILTERS = 5;

/**
 * Finding an entry again, by a word in it or by the feeling it carried.
 *
 * The filters travel with the results because they answer the same question —
 * what can I narrow this by — and fetching them apart would let the pills
 * describe a journal the results no longer come from.
 */
export class SearchEntries {
  constructor(private readonly repository: IMoodEntryRepository) {}

  async execute(input: SearchEntriesInput = {}): Promise<SearchResult> {
    const entries = await this.repository.findAll();
    const query = (input.query ?? '').trim().toLocaleLowerCase();
    const emotionId = input.emotionId ?? null;

    return {
      entries: entries.filter(
        (entry) =>
          (query.length === 0 || matches(entry, query)) &&
          (emotionId === null || entry.emotionIds.includes(emotionId)),
      ),
      filterIds: mostUsed(entries),
    };
  }
}

/**
 * The sentence and the tags, which is what someone remembers an entry by. Not
 * the raw transcript: searching what the recogniser heard rather than what the
 * entry says would return a card on a word that is not in it.
 */
function matches(entry: MoodEntry, query: string): boolean {
  return (
    entry.cleanTranscript.toLocaleLowerCase().includes(query) ||
    entry.contextTags.some((tag) => tag.toLocaleLowerCase().includes(query))
  );
}

function mostUsed(entries: readonly MoodEntry[]): readonly string[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const id of entry.emotionIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    // The word breaks a tie, so the pills do not reshuffle between visits.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MOST_FILTERS)
    .map(([id]) => id);
}
