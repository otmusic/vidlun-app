import type { MonthVoicePart } from '@/application/use-cases/ComposeMonthVoice';
import type { Locale } from '@/i18n';

/** Back past this far into a take, "previous" starts the take again rather than going back one. */
export const RESTART_WITHIN_MS = 2_000;

/**
 * Which part is playing at `ms`: the last one started by then. The quiet
 * after a take still belongs to it, so the sentence on screen does not
 * flicker between days.
 */
export function partAt(parts: readonly MonthVoicePart[], ms: number): number {
  let current = 0;

  parts.forEach((part, at) => {
    if (part.startMs <= ms) {
      current = at;
    }
  });

  return current;
}

/** Where "previous" goes: the start of this take, or of the one before when just begun. */
export function previousStart(parts: readonly MonthVoicePart[], ms: number): number {
  const at = partAt(parts, ms);
  const part = parts[at];

  if (part === undefined) {
    return 0;
  }

  if (ms - part.startMs > RESTART_WITHIN_MS || at === 0) {
    return part.startMs;
  }

  return parts[at - 1]?.startMs ?? 0;
}

/** Where "next" goes; null on the last take. */
export function nextStart(parts: readonly MonthVoicePart[], ms: number): number | null {
  return parts[partAt(parts, ms) + 1]?.startMs ?? null;
}

/** How far into a part `ms` is, from 0 to 1. */
export function playedOf(part: MonthVoicePart, ms: number): number {
  const length = part.endMs - part.startMs;

  return length <= 0 ? 1 : Math.min(1, Math.max(0, (ms - part.startMs) / length));
}

/** How long the month plays, as the page says it: whole minutes, or seconds under one. */
export function lengthWords(ms: number): { readonly unit: 'minutes' | 'seconds'; readonly n: number } {
  return ms < 60_000
    ? { unit: 'seconds', n: Math.max(1, Math.round(ms / 1000)) }
    : { unit: 'minutes', n: Math.max(1, Math.round(ms / 60_000)) };
}

/**
 * The month's first and last day in the words the line under the player
 * takes: the day alone first and the day with its month last in Ukrainian
 * ("1" to "31 October", as it reads there), the other way round in English.
 */
export function monthSpanWords(monthStart: Date, locale: Locale): { readonly first: string; readonly last: string } {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const last = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const dayAndMonth = { day: 'numeric', month: 'long' } as const;

  return locale === 'uk'
    ? { first: String(first.getDate()), last: last.toLocaleDateString(locale, dayAndMonth) }
    : { first: first.toLocaleDateString(locale, dayAndMonth), last: String(last.getDate()) };
}

/** An entry's day and time, as the playing take is named on the page and the lock screen. */
export function whenSaid(at: Date, locale: Locale): string {
  const day = at.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const time = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return `${day} · ${time}`;
}
