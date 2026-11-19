import type {
  IPurchases,
  Plan,
  PurchaseOutcome,
  SubscriptionStatus,
} from '../../domain/ports/IPurchases';

/**
 * Priced as the owner set them on 2026-08-29, and formatted the way a store
 * would: the screen must never build a price string itself.
 */
// The store's own US tier prices, so a screenshot of the pretend paywall
// shows what the App Store review team will themselves be shown.
const PRETEND_PLANS: readonly Plan[] = [
  { id: 'monthly', kind: 'monthly', price: '$4.99', amount: 4.99, trialDays: 0 },
  { id: 'annual', kind: 'annual', price: '$29.99', amount: 29.99, trialDays: 7 },
  { id: 'lifetime', kind: 'lifetime', price: '$79.99', amount: 79.99, trialDays: 0 },
];

/**
 * A store that answers whatever the screens need to be walked through.
 *
 * The paid half has states no real store will produce on request — a declined
 * card, a restore that finds nothing, a subscription that is simply already
 * active — and every one of them is drawn. Without this they could only be
 * seen by breaking something on purpose.
 *
 * **Development only, and behind its own flag.** It grants entitlement, which
 * is exactly what `UnavailablePurchases` refuses to do: a build that sold
 * nothing but let people read everything would be indistinguishable from a
 * broken paywall on the day the real one lands.
 */
export class FakePurchases implements IPurchases {
  private active: boolean;
  private readonly listeners = new Set<() => void>();

  constructor(
    /** What the next purchase or restore will answer. */
    private readonly script: PurchaseOutcome = 'bought',
    startsActive = false,
  ) {
    this.active = startsActive;
  }

  status(): Promise<SubscriptionStatus> {
    const renewsAt = new Date();

    renewsAt.setMonth(renewsAt.getMonth() + 1);

    return Promise.resolve({
      active: this.active,
      // The month is the one plan sold since 2026-10-23, and it carries no
      // free days: what is bought here is paid for at once.
      inTrial: false,
      renewsAt: this.active ? renewsAt : null,
    });
  }

  plans(): Promise<readonly Plan[]> {
    return Promise.resolve(PRETEND_PLANS);
  }

  subscribe(): Promise<PurchaseOutcome> {
    if (this.script === 'bought') {
      this.active = true;
    }

    return Promise.resolve(this.script);
  }

  restore(): Promise<PurchaseOutcome> {
    // A script that says "bought" restores; anything else is what it says.
    const outcome = this.script === 'bought' ? 'restored' : this.script;

    if (outcome === 'restored') {
      this.active = true;
    }

    return Promise.resolve(outcome);
  }

  /**
   * A code that always works, as a redeemed one does: the store grants the
   * subscription a moment after the sheet, and says so through the listener.
   */
  redeemCode(): Promise<void> {
    setTimeout(() => {
      this.active = true;
      this.listeners.forEach((listener) => {
        listener();
      });
    }, REDEEMED_AFTER_MS);

    return Promise.resolve();
  }

  onStatusChange(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** About how long Apple's sheet takes to take a code and close. */
const REDEEMED_AFTER_MS = 1500;
