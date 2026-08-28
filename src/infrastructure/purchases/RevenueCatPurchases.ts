import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import type { IPurchases, PurchaseOutcome, SubscriptionStatus } from '../../domain/ports/IPurchases';

/**
 * The one thing sold, named in the RevenueCat dashboard. §M5 sells exactly one
 * thing, so there is one id here and no catalogue to match against.
 */
export const NARRATIVE_ENTITLEMENT = 'narrative';

/** Configured once per launch; the container may be rebuilt more often than that. */
let configured = false;

/**
 * The App Store, through RevenueCat.
 *
 * Apple requires in-app purchase for anything consumed inside the app, so the
 * money goes through Apple whatever we use. RevenueCat is here for the one
 * thing §2 rules out doing ourselves: validating the receipt. Without a server
 * the only alternative is trusting the device, which is trusting anyone who
 * reads the documentation.
 *
 * It never sees an entry. What crosses the wire is a purchase, an Apple
 * receipt and an anonymous id — no transcript, no emotion, no recording.
 */
export class RevenueCatPurchases implements IPurchases {
  constructor(apiKey: string) {
    if (!configured) {
      Purchases.configure({ apiKey });
      configured = true;
    }
  }

  async status(): Promise<SubscriptionStatus> {
    return readStatus(await Purchases.getCustomerInfo());
  }

  async subscribe(): Promise<PurchaseOutcome> {
    const offering = (await Purchases.getOfferings()).current;
    const item: PurchasesPackage | undefined = offering?.availablePackages[0];

    if (item === undefined) {
      /*
       * Nothing to sell means the product is not configured or the store is
       * unreachable. Both are failures to the person looking at the price, and
       * neither is their fault to explain.
       */
      return 'failed';
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(item);

      return readStatus(customerInfo).active ? 'bought' : 'failed';
    } catch (error) {
      // Closing Apple's sheet is a decision, not an error, and the screen says
      // nothing at all about it.
      return wasCancelled(error) ? 'cancelled' : 'failed';
    }
  }

  async restore(): Promise<PurchaseOutcome> {
    try {
      return readStatus(await Purchases.restorePurchases()).active
        ? 'restored'
        : 'nothingToRestore';
    } catch {
      return 'failed';
    }
  }
}

function readStatus(info: CustomerInfo): SubscriptionStatus {
  const entitlement = info.entitlements.active[NARRATIVE_ENTITLEMENT];

  if (entitlement === undefined) {
    return { active: false, renewsAt: null };
  }

  const renewsAt =
    entitlement.expirationDate === null ? null : new Date(entitlement.expirationDate);

  return {
    active: true,
    // A date the store could not parse is not a date to show anyone.
    renewsAt: renewsAt !== null && !Number.isNaN(renewsAt.getTime()) ? renewsAt : null,
  };
}

/** The SDK reports this on the error object rather than as its own type. */
function wasCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { userCancelled?: boolean }).userCancelled === true
  );
}
