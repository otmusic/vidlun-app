import type { Locale, Translate } from '@/i18n';

/** "Today" and "yesterday" by name, the date only further back. */
export function dayWordOf(date: Date, today: Date, locale: Locale, t: Translate): string {
  const startOf = (of: Date) => new Date(of.getFullYear(), of.getMonth(), of.getDate()).getTime();
  const daysAgo = Math.round((startOf(today) - startOf(date)) / (24 * 60 * 60 * 1000));

  if (daysAgo === 0) {
    return t('history.today');
  }

  if (daysAgo === 1) {
    return t('history.yesterday');
  }

  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}
