import type { IPurchases, PurchaseOutcome, SubscriptionStatus } from '../../domain/ports/IPurchases';

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

    return Promise.resolve({ active: this.active, renewsAt: this.active ? renewsAt : null });
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
