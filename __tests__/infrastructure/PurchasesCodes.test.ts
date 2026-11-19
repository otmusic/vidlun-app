import type { IPurchases } from '@/domain/ports/IPurchases';
import { EverythingFree } from '@/infrastructure/purchases/EverythingFree';
import { FakePurchases } from '@/infrastructure/purchases/FakePurchases';
import { UnavailablePurchases } from '@/infrastructure/purchases/UnavailablePurchases';

describe('a promo code', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens the subscription a moment after the sheet, and says so to whoever listens', async () => {
    const store = new FakePurchases();
    const heard = jest.fn();

    store.onStatusChange(heard);
    await store.redeemCode();

    expect((await store.status()).active).toBe(false);

    jest.runAllTimers();

    expect(heard).toHaveBeenCalledTimes(1);
    expect((await store.status()).active).toBe(true);
  });

  it('stops telling a listener that has left', async () => {
    const store = new FakePurchases();
    const heard = jest.fn();
    const stop = store.onStatusChange(heard);

    stop();
    await store.redeemCode();
    jest.runAllTimers();

    expect(heard).not.toHaveBeenCalled();
  });

  it('grants nothing where there is no store, and nothing more where all is free', async () => {
    const stores: readonly IPurchases[] = [new UnavailablePurchases(), new EverythingFree()];

    for (const store of stores) {
      const before = await store.status();
      const heard = jest.fn();

      store.onStatusChange(heard)();
      await store.redeemCode();
      jest.runAllTimers();

      expect(await store.status()).toEqual(before);
      expect(heard).not.toHaveBeenCalled();
    }
  });
});
