import { isTrialLive, isTrialSpent, TRIAL_DAYS } from '@/domain/entities/Trial';

const STARTED = new Date(2026, 7, 20, 9, 0);
const day = (n: number): Date => new Date(STARTED.getTime() + n * 24 * 60 * 60 * 1000);

describe('the free week', () => {
  it('has not started for someone who never asked for it', () => {
    expect(isTrialLive(null, STARTED)).toBe(false);
    // Never started is not spent: they are still owed the offer.
    expect(isTrialSpent(null, STARTED)).toBe(false);
  });

  it('runs for the days it promises and not one more', () => {
    expect(isTrialLive(STARTED, day(TRIAL_DAYS - 1))).toBe(true);
    expect(isTrialLive(STARTED, day(TRIAL_DAYS))).toBe(false);
  });

  it('counts as spent only after it ran', () => {
    expect(isTrialSpent(STARTED, day(1))).toBe(false);
    expect(isTrialSpent(STARTED, day(TRIAL_DAYS))).toBe(true);
  });
});
