import type { MoodEntry } from '@/domain/entities/MoodEntry';

/**
 * A handful of entries the journal is opened on from somewhere else — the
 * stats screen's "see these days" (owner's word, 2026-10-14) — under a label
 * that says which handful it is.
 */
export interface JournalFocus {
  readonly label: string;
  readonly entryIds: readonly string[];
}

/**
 * Every emotion on the journal's entries, the most used first, for the
 * journal's filter to offer: what this person has felt, not the whole
 * vocabulary. The id breaks a tie, so the sheet reads the same twice.
 */
export function emotionsUsed(entries: readonly MoodEntry[]): readonly string[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const id of new Set(entry.emotionIds)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

/**
 * The entries holding any of the chosen emotions; all of them when none is
 * chosen. Any rather than all: picking calm and joy asks for the days that
 * held either, and a day that held both is still one of them.
 */
export function entriesWithAny(
  entries: readonly MoodEntry[],
  emotionIds: readonly string[],
): readonly MoodEntry[] {
  if (emotionIds.length === 0) {
    return entries;
  }

  const wanted = new Set(emotionIds);

  return entries.filter((entry) => entry.emotionIds.some((id) => wanted.has(id)));
}

/**
 * What the journal is narrowed to (owner's word, 2026-11-24, canvas variant
 * A): emotions, topics, or both. Empty in both shows every entry.
 */
export interface JournalFilter {
  readonly emotionIds: readonly string[];
  readonly topics: readonly string[];
}

export const NO_FILTER: JournalFilter = { emotionIds: [], topics: [] };

/** How many words the filter holds, for the badge on its button. */
export function filterSize(filter: JournalFilter): number {
  return filter.emotionIds.length + filter.topics.length;
}

/**
 * Every topic on the journal's entries, the most used first, for the filter
 * to offer next to the emotions: the person's own topics, not a list. The
 * topic itself breaks a tie, so the sheet reads the same twice.
 */
export function topicsUsed(entries: readonly MoodEntry[]): readonly string[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const tag of new Set(entry.contextTags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

/**
 * The entries the filter keeps: any of the chosen emotions, any of the
 * chosen topics, and with both chosen, one of each — calm and work asks for
 * the calm days at work, not every calm day and every work day.
 */
export function entriesMatching(entries: readonly MoodEntry[], filter: JournalFilter): readonly MoodEntry[] {
  const topics = new Set(filter.topics);
  const byEmotion = entriesWithAny(entries, filter.emotionIds);

  return topics.size === 0 ? byEmotion : byEmotion.filter((entry) => entry.contextTags.some((tag) => topics.has(tag)));
}
