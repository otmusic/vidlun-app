import { daysLabel, periodLabel } from '@/presentation/components/periodLabel';

const TODAY = new Date(2026, 10, 12, 13, 30);
const JOURNAL = { earliest: new Date(2026, 8, 3), today: TODAY };

function label(from: Date, to: Date, locale: 'en' | 'uk' = 'en'): string {
  return periodLabel({ from, to }, locale, JOURNAL);
}

describe('what the period pill says', () => {
  it('names the days picked, not the month they fall in', () => {
    expect(label(new Date(2026, 10, 10), new Date(2026, 10, 12))).toBe('Nov 10–11');
  });

  it('puts the run of days in the order Ukrainian writes a date in', () => {
    expect(label(new Date(2026, 10, 10), new Date(2026, 10, 12), 'uk')).toBe(
      `10–${new Date(2026, 10, 11).toLocaleDateString('uk', { day: 'numeric', month: 'short' })}`,
    );
  });

  it('names one day once', () => {
    expect(label(new Date(2026, 10, 10), new Date(2026, 10, 11))).toBe('Nov 10');
  });

  it('names both months when the days cross into the next', () => {
    expect(label(new Date(2026, 9, 28), new Date(2026, 10, 4))).toBe('Oct 28 – Nov 3');
  });

  it('still names the month alone for this month up to today', () => {
    expect(label(new Date(2026, 10, 1), new Date(2026, 10, 13))).toBe('Nov');
  });

  it('names a whole past month by its name', () => {
    expect(label(new Date(2026, 9, 1), new Date(2026, 10, 1))).toBe('Oct');
  });

  it('names the first and last months of a stretch of several', () => {
    expect(label(new Date(2026, 8, 1), new Date(2026, 10, 13))).toBe('Sep – Nov');
  });

  it('starts all time at the journal’s first month, not at the year 2000', () => {
    expect(label(new Date(2000, 0, 1), new Date(2026, 10, 13))).toBe('Sep – Nov');
  });

  it('gives the year of a period that ended in another one', () => {
    expect(label(new Date(2025, 11, 10), new Date(2025, 11, 12))).toBe('Dec 10–11, 2025');
  });
});

describe('the summary under the calendar', () => {
  it('reads a picked run of days the way the pill will', () => {
    expect(daysLabel(new Date(2026, 10, 1), new Date(2026, 10, 12), 'en', TODAY)).toBe('Nov 1–12');
  });
});
