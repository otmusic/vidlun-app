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
      // Whatever was bought here came with free days, which is what the
      // annual plan really offers and the state the screens differ on.
      inTrial: this.active,
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
}
