import { entitlementOf, readsInFull } from '@/domain/entities/Entitlement';
import { EverythingFree } from '@/infrastructure/purchases/EverythingFree';

describe('the store while nothing is sold', () => {
  const store = new EverythingFree();

  it('opens everything to everyone', async () => {
    expect(readsInFull(entitlementOf(await store.status()))).toBe(true);
  });

  it('reads as held outright, not as a running trial', async () => {
    expect(entitlementOf(await store.status())).toBe('subscribed');
  });

  it('has nothing to offer and nothing to restore', async () => {
    expect(await store.plans()).toEqual([]);
    expect(await store.restore()).toBe('nothingToRestore');
  });
});
