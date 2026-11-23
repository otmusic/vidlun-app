import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { topicKey } from '../../domain/entities/Topic';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

/**
 * Every topic in the journal, the one named in most entries first, each in
 * the spelling it has most often (owner's word, 2026-11-23): the spelling a
 * topic written in on the card is saved with, so "Work" typed where the
 * journal says "work" stays one theme. Nothing of it is shown; the card
 * offers no topics (owner's word, the same day).
 *
 * Read when the person opens the topic line, never on the way to the card:
 * nothing on the capture path waits for it.
 */
export class KnownTopics {
  constructor(private readonly repository: IMoodEntryRepository) {}

  async execute(): Promise<readonly string[]> {
    return spellings(await this.repository.findAll());
  }
}

/**
 * Counted per entry, as the week counts them. Ties break alphabetically, so
 * the offer reads the same twice.
 */
function spellings(entries: readonly MoodEntry[]): readonly string[] {
  const byKey = new Map<string, Map<string, number>>();

  for (const entry of entries) {
    for (const tag of new Set(entry.contextTags)) {
      const key = topicKey(tag);
      const forms = byKey.get(key) ?? new Map<string, number>();

      forms.set(tag, (forms.get(tag) ?? 0) + 1);
      byKey.set(key, forms);
    }
  }

  return [...byKey.values()]
    .map((forms) => {
      const ranked = [...forms.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

      return {
        spelling: ranked[0]?.[0] ?? '',
        entryCount: ranked.reduce((sum, [, count]) => sum + count, 0),
      };
    })
    .sort((a, b) => b.entryCount - a.entryCount || a.spelling.localeCompare(b.spelling))
    .map((each) => each.spelling);
}
