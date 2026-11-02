/**
 * The days the person wrote something, for the dots on the period calendar
 * (owner's word, 2026-10-30): a calendar of bare numbers gives no hint which
 * stretch holds entries and which is empty.
 *
 * Keyed by local midnight, the same boundary the journal groups its days by,
 * so an entry written at 23:50 marks its own day and not the next one.
 */
export function entryDays(history: readonly { readonly day: Date }[]): ReadonlySet<number> {
  return new Set(history.map((day) => localMidnight(day.day)));
}

export function wroteOn(days: ReadonlySet<number>, day: Date): boolean {
  return days.has(localMidnight(day));
}

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
