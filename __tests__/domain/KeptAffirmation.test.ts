import { affirmationPeriodEnd } from '@/domain/entities/KeptAffirmation';

describe('affirmationPeriodEnd', () => {
  // Friday, 6 November 2026, in the afternoon.
  const friday = new Date(2026, 10, 6, 14, 30);

  it('keeps a daily one until midnight', () => {
    expect(affirmationPeriodEnd(friday, 'daily')).toEqual(new Date(2026, 10, 7));
  });

  it('keeps a weekly one until the coming Monday', () => {
    expect(affirmationPeriodEnd(friday, 'weekly')).toEqual(new Date(2026, 10, 9));
  });

  it('counts a Monday as the start of its week, not the end of the last one', () => {
    expect(affirmationPeriodEnd(new Date(2026, 10, 9, 10, 0), 'weekly')).toEqual(new Date(2026, 10, 16));
  });

  it('ends a week picked on Sunday night at the Monday right after', () => {
    expect(affirmationPeriodEnd(new Date(2026, 10, 8, 23, 50), 'weekly')).toEqual(new Date(2026, 10, 9));
  });

  it('keeps a monthly one until the first of next month', () => {
    expect(affirmationPeriodEnd(friday, 'monthly')).toEqual(new Date(2026, 11, 1));
  });

  it('carries a December pick into January', () => {
    expect(affirmationPeriodEnd(new Date(2026, 11, 31, 9, 0), 'monthly')).toEqual(new Date(2027, 0, 1));
    expect(affirmationPeriodEnd(new Date(2026, 11, 31, 9, 0), 'daily')).toEqual(new Date(2027, 0, 1));
  });
});
