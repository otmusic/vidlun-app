/**
 * The days the person wrote something, and the mood each was, for the dots on
 * the period calendar (owner's word, 2026-10-30: a calendar of bare numbers
 * gives no hint which stretch holds entries; 2026-11-11: the dot is the
 * day's mood).
 *
 * Keyed by local midnight, the same boundary the journal groups its days by,
 * so an entry written at 23:50 marks its own day and not the next one. The
 * mood is the day's average, as the week strip on home takes it; null when
 * none of the day's entries gave one, which is a written day all the same.
 */
export type EntryDays = ReadonlyMap<number, number | null>;

interface DayOfEntries {
  readonly day: Date;
  readonly entries?: readonly { readonly mood: { readonly value: number } | null }[];
}

export function entryDays(history: readonly DayOfEntries[]): EntryDays {
  return new Map(history.map((day) => [localMidnight(day.day), averageMood(day.entries ?? [])]));
}

export function wroteOn(days: EntryDays, day: Date): boolean {
  return days.has(localMidnight(day));
}

/** The day's average mood; null for a day with no entry or none that gave a mood. */
export function moodOn(days: EntryDays, day: Date): number | null {
  return days.get(localMidnight(day)) ?? null;
}

function averageMood(entries: readonly { readonly mood: { readonly value: number } | null }[]): number | null {
  const scored = entries.flatMap((entry) => (entry.mood === null ? [] : [entry.mood.value]));

  if (scored.length === 0) {
    return null;
  }

  return Math.round((scored.reduce((sum, value) => sum + value, 0) / scored.length) * 10) / 10;
}

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
