import { entryDays, moodOn, wroteOn } from '@/presentation/components/entryDays';

const mood = (value: number) => ({ mood: { value } });
const noMood = { mood: null };

describe('the days the calendar marks', () => {
  const days = entryDays([
    { day: new Date(2026, 9, 29), entries: [mood(5), mood(4)] },
    { day: new Date(2026, 9, 27), entries: [noMood] },
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

  it('colours a day by its average mood, as the week strip does', () => {
    expect(moodOn(days, new Date(2026, 9, 29, 12))).toBe(4.5);
  });

  it('keeps a written day whose entries gave no mood, without one', () => {
    expect(wroteOn(days, new Date(2026, 9, 27))).toBe(true);
    expect(moodOn(days, new Date(2026, 9, 27))).toBeNull();
  });

  it('leaves out the entries that gave no mood rather than counting them as zero', () => {
    const mixed = entryDays([{ day: new Date(2026, 9, 30), entries: [mood(2), noMood] }]);

    expect(moodOn(mixed, new Date(2026, 9, 30))).toBe(2);
  });
});
