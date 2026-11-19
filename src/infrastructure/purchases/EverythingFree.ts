import type {
  IPurchases,
  Plan,
  PurchaseOutcome,
  SubscriptionStatus,
} from '../../domain/ports/IPurchases';

/**
 * The store while nothing is sold: everyone reads in full and there is nothing
 * to buy (owner's word, 2026-11-02, "for now"). Unlike `UnavailablePurchases`,
 * which is a store that is missing, this is a decision, so it grants rather
 * than refuses. The store itself is not asked anything.
 */
export class EverythingFree implements IPurchases {
  status(): Promise<SubscriptionStatus> {
    return Promise.resolve({ active: true, inTrial: false, renewsAt: null });
  }

  plans(): Promise<readonly Plan[]> {
    return Promise.resolve([]);
  }

  subscribe(): Promise<PurchaseOutcome> {
    return Promise.resolve<PurchaseOutcome>('failed');
  }

  restore(): Promise<PurchaseOutcome> {
    return Promise.resolve<PurchaseOutcome>('nothingToRestore');
  }

  /** Everything is already open; there is nothing a code could add. */
  redeemCode(): Promise<void> {
    return Promise.resolve();
  }

  /** Nothing here ever changes. */
  onStatusChange(): () => void {
    return () => undefined;
  }
}
