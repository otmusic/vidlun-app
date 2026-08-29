/**
 * What came of asking the store for money, in the shapes a screen has to say
 * something different about.
 *
 * `cancelled` is not a failure and must never be shown as one: someone who
 * closed the sheet made a decision, and telling them it went wrong would be
 * the app arguing with them.
 */
export type PurchaseOutcome = 'bought' | 'restored' | 'nothingToRestore' | 'cancelled' | 'failed';

/**
 * The three shapes the one thing is sold in. Monthly exists mostly as an
 * anchor — the yearly price is read against it — and lifetime is for people
 * who will not hold a subscription at all.
 */
export type PlanKind = 'monthly' | 'annual' | 'lifetime';

export interface Plan {
  /** The store's own identifier, handed back to `subscribe`. */
  readonly id: string;
  readonly kind: PlanKind;
  /**
   * Already formatted by the store, in the buyer's own currency. Never built
   * here and never in the locale files: a price written into a translation is
   * right in one country and wrong in every other.
   */
  readonly price: string;
  /** The same amount as a number, for working out what the year saves. */
  readonly amount: number;
  /** Days of free trial the store will grant, or zero. */
  readonly trialDays: number;
}

export interface SubscriptionStatus {
  readonly active: boolean;
  /** True while the free days are running, which reads differently on screen. */
  readonly inTrial: boolean;
  /** When it renews, where the store says. Null when it does not know. */
  readonly renewsAt: Date | null;
}

/**
 * The store, behind a port like everything else that talks to the outside.
 *
 * §M5 sells one thing — the weekly narrative — in more than one shape. What is
 * bought is always the same entitlement, so nothing above this layer branches
 * on which plan someone chose.
 */
export interface IPurchases {
  status(): Promise<SubscriptionStatus>;
  /** What is on offer, cheapest period first. Empty when the store has nothing. */
  plans(): Promise<readonly Plan[]>;
  subscribe(planId: string): Promise<PurchaseOutcome>;
  restore(): Promise<PurchaseOutcome>;
}
