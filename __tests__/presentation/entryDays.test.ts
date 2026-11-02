import { entryDays, wroteOn } from '@/presentation/components/entryDays';

describe('the days the calendar marks', () => {
  const days = entryDays([
    { day: new Date(2026, 9, 29) },
    { day: new Date(2026, 9, 27) },
  ]);

  it('marks a day the journal has entries on', () => {
    expect(wroteOn(days, new Date(2026, 9, 29))).toBe(true);
  });

  it('leaves a day without entries unmarked', () => {
    expect(wroteOn(days, new Date(2026, 9, 28))).toBe(false);
  });

  it('matches a day whatever hour the calendar hands it with', () => {
    expect(wroteOn(days, new Date(2026, 9, 27, 23, 50))).toBe(true);
  });

  it('marks nothing in an empty journal', () => {
    expect(wroteOn(entryDays([]), new Date(2026, 9, 29))).toBe(false);
  });
});
