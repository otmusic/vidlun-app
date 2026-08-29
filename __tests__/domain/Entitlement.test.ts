import { entitlementOf, readsInFull } from '@/domain/entities/Entitlement';

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
