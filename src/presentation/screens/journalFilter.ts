import type { MoodEntry } from '@/domain/entities/MoodEntry';

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
