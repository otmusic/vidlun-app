/**
 * What came of asking the store for money, in the four shapes a screen has to
 * say something different about.
 *
 * `cancelled` is not a failure and must never be shown as one: someone who
 * closed the sheet made a decision, and telling them it went wrong would be
 * the app arguing with them.
 */
export type PurchaseOutcome = 'bought' | 'restored' | 'nothingToRestore' | 'cancelled' | 'failed';

export interface SubscriptionStatus {
  readonly active: boolean;
  /** When it renews, where the store says. Null when it does not know. */
  readonly renewsAt: Date | null;
}

/**
 * The store, behind a port like everything else that talks to the outside.
 *
 * §M5 sells exactly one thing, so this has no catalogue and no product ids in
 * its shape: one subscription, bought or not. A second paid thing would be a
 * new method here and a decision in the brief first.
 */
export interface IPurchases {
  status(): Promise<SubscriptionStatus>;
  subscribe(): Promise<PurchaseOutcome>;
  restore(): Promise<PurchaseOutcome>;
}
