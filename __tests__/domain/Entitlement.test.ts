import { entitlementOf, readsInFull } from '@/domain/entities/Entitlement';
import { TRIAL_DAYS } from '@/domain/entities/Trial';

const STARTED = new Date(2026, 7, 20, 9, 0);
const day = (n: number): Date => new Date(STARTED.getTime() + n * 24 * 60 * 60 * 1000);

describe('what someone may read', () => {
  it('offers the free week to someone who has never taken it', () => {
    expect(entitlementOf({ subscribed: false, trialStartedAt: null, now: STARTED })).toBe('none');
  });

  it('opens everything while the free week runs', () => {
    const state = entitlementOf({ subscribed: false, trialStartedAt: STARTED, now: day(2) });

    expect(state).toBe('trial');
    expect(readsInFull(state)).toBe(true);
  });

  it('tells a spent week apart from one never taken', () => {
    const state = entitlementOf({
      subscribed: false,
      trialStartedAt: STARTED,
      now: day(TRIAL_DAYS),
    });

    // The offer changes from "seven days free" to "charged right away", and
    // promising a week that is gone is a promise the store then breaks.
    expect(state).toBe('trialSpent');
    expect(readsInFull(state)).toBe(false);
  });

  it('lets a purchase outrank the week it was made during', () => {
    const state = entitlementOf({ subscribed: true, trialStartedAt: STARTED, now: day(1) });

    // Someone who bought has bought, and must not be told their week runs out.
    expect(state).toBe('subscribed');
  });
});
