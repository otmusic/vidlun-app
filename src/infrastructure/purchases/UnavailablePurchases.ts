import type { IPurchases, PurchaseOutcome, SubscriptionStatus } from '../../domain/ports/IPurchases';

/**
 * The store, before there is a store.
 *
 * Buying fails and restoring finds nothing, which is exactly what is true: no
 * payment SDK is wired yet. It fails rather than pretending to succeed because
 * a stub that granted entitlement would put people behind a paywall they never
 * paid for, and the day the real adapter lands they would silently lose it.
 *
 * Replacing this is one class. Nothing above it knows which store it talks to.
 */
export class UnavailablePurchases implements IPurchases {
  status(): Promise<SubscriptionStatus> {
    return Promise.resolve({ active: false, renewsAt: null });
  }

  subscribe(): Promise<PurchaseOutcome> {
    return Promise.resolve<PurchaseOutcome>('failed');
  }

  restore(): Promise<PurchaseOutcome> {
    return Promise.resolve<PurchaseOutcome>('nothingToRestore');
  }
}
