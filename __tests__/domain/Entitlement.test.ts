import { entitlementOf, readsInFull, FREE_ENTRIES_PER_DAY, mayWriteAnother } from '@/domain/entities/Entitlement';

describe('entitlementOf', () => {
  it('reads an inactive store answer as nothing owned', () => {
    expect(entitlementOf({ active: false, inTrial: false, renewsAt: null })).toBe('none');
  });

  it('reads the free days as the trial', () => {
    expect(entitlementOf({ active: true, inTrial: true, renewsAt: null })).toBe('trial');
  });

  it('reads a paid period as subscribed', () => {
    expect(entitlementOf({ active: true, inTrial: false, renewsAt: null })).toBe('subscribed');
  });

  it('never trusts inTrial on its own', () => {
    // A store bug or a stale cache saying "in trial" of an inactive
    // subscription must not open anything.
    expect(entitlementOf({ active: false, inTrial: true, renewsAt: null })).toBe('none');
  });
});

describe('readsInFull', () => {
  it('opens the narrative for the trial and the subscription alike', () => {
    expect(readsInFull('trial')).toBe(true);
    expect(readsInFull('subscribed')).toBe(true);
    expect(readsInFull('none')).toBe(false);
  });
});

describe('the free daily entries', () => {
  // Owner's word, 2026-11-16: two a day free, no limit with a subscription.
  it('lets two entries a day be made without a subscription, and not a third', () => {
    expect(FREE_ENTRIES_PER_DAY).toBe(2);
    expect(mayWriteAnother(false, 0)).toBe(true);
    expect(mayWriteAnother(false, 1)).toBe(true);
    expect(mayWriteAnother(false, 2)).toBe(false);
  });

  it('sets no limit with a subscription or its free week', () => {
    expect(mayWriteAnother(true, 12)).toBe(true);
  });
});
