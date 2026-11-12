import type { Locale } from '@/i18n';

/** A period, `from` inclusive and `to` exclusive, as the use case takes it. */
export interface Period {
  readonly from: Date;
  readonly to: Date;
}

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const MONTH: Intl.DateTimeFormatOptions = { month: 'short' };

/**
 * What the period pill on "Your emotions" says: the period that is counted.
 *
 * It used to name only the month, so two days picked in the calendar read as
 * the whole of November and the counts under it looked too many (owner's word,
 * 2026-11-12). Whole months still read as months — "this month", "last
 * month", "three months" — and anything else as its days.
 *
 * "All time" starts in 2000 so it holds any journal; the label starts at the
 * journal's own first month instead of naming a January nobody wrote in.
 */
export function periodLabel(
  period: Period,
  locale: Locale,
  journal: { readonly earliest: Date; readonly today: Date },
): string {
  const last = addDays(period.to, -1);

  if (!coversWholeMonths(period, journal.today)) {
    return daysLabel(period.from, last, locale, journal.today);
  }

  const lastMonth = startOfMonth(last);
  const first = latest(startOfMonth(period.from), startOfMonth(journal.earliest), lastMonth);
  const options = inYearOf(journal.today, last) ? MONTH : { ...MONTH, year: 'numeric' as const };
  const end = last.toLocaleDateString(locale, options);

  return first.getTime() === lastMonth.getTime()
    ? end
    : `${first.toLocaleDateString(locale, MONTH)} – ${end}`;
}

/**
 * A run of days as short as it reads: one day alone, a run inside one month
 * with the month said once ("10–11 Nov" in Ukrainian's order, "Nov 10–11"),
 * and both months only when it crosses one. The year only when it is not
 * this one.
 */
export function daysLabel(first: Date, last: Date, locale: Locale, today: Date): string {
  const options = inYearOf(today, last) ? DAY : { ...DAY, year: 'numeric' as const };
  const end = last.toLocaleDateString(locale, options);

  if (first.getTime() === last.getTime()) {
    return end;
  }

  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    // The first day goes in front of the last, wherever the locale puts the
    // day: "11 Nov" becomes "10–11 Nov" in Ukrainian's order, "Nov 11"
    // becomes "Nov 10–11". Neither locale writes a digit before the day.
    const day = String(last.getDate());

    return end.replace(day, `${first.getDate()}–${day}`);
  }

  return `${first.toLocaleDateString(locale, DAY)} – ${end}`;
}

/**
 * From the first of a month to the first of another, or to the end of today:
 * what the month presets give, and what picking the 1st up to today means.
 */
function coversWholeMonths(period: Period, today: Date): boolean {
  const endsMonth = period.to.getDate() === 1;
  const endsToday = period.to.getTime() === addDays(startOfDay(today), 1).getTime();

  return period.from.getDate() === 1 && (endsMonth || endsToday);
}

function inYearOf(today: Date, day: Date): boolean {
  return today.getFullYear() === day.getFullYear();
}

/** The later of `a` and `b`, but never past `cap`. */
function latest(a: Date, b: Date, cap: Date): Date {
  const later = a > b ? a : b;

  return later > cap ? cap : later;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const shifted = new Date(date.getTime());

  shifted.setDate(shifted.getDate() + days);

  return shifted;
}
