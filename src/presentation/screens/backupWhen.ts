import type { Locale, Translate } from '@/i18n';

/**
 * The day of the last backup as the profile says it (owner's word,
 * 2026-11-19): "today" and "yesterday" for the last two days, the day and
 * month otherwise, and the year only when it is not this one. Nothing in it
 * changes with how long ago that was: a date, not a reproach.
 */
export function backupWhen(at: Date, now: Date, locale: Locale, t: Translate): string {
  if (sameDay(at, now)) {
    return t('profile.backupToday');
  }

  if (sameDay(at, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) {
    return t('profile.backupYesterday');
  }

  const dayAndMonth = at.toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  if (at.getFullYear() === now.getFullYear()) {
    return dayAndMonth;
  }

  // Added by hand: Ukrainian dates with a year end in an abbreviation and a stop, and the line ends in one.
  return locale === 'uk'
    ? `${dayAndMonth} ${String(at.getFullYear())}`
    : at.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
