import Purchases, {
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import type {
  IPurchases,
  Plan,
  PlanKind,
  PurchaseOutcome,
  SubscriptionStatus,
} from '../../domain/ports/IPurchases';

/**
 * The one thing sold, named in the RevenueCat dashboard. Every plan grants it,
 * so nothing above this layer knows which one someone bought.
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

  async plans(): Promise<readonly Plan[]> {
    let offering;

    try {
      offering = (await Purchases.getOfferings()).current;
    } catch {
      /*
       * The SDK throws here for what is really "the store would not answer" —
       * an unsigned agreement, products still propagating, no network. None
       * of that is the person's to fix, and the screen has a calm sentence
       * for an empty store; the generic failure screen would tell them
       * something went wrong with what they did, which is not true.
       */
      return [];
    }

    if (offering === null) {
      // No current offering configured leaves the same nothing to price.
      return [];
    }

    return offering.availablePackages
      .map(planOf)
      .filter((plan): plan is Plan => plan !== null)
      .sort((a, b) => a.amount - b.amount);
  }

  async subscribe(planId: string): Promise<PurchaseOutcome> {
    const offering = (await Purchases.getOfferings()).current;
    const item = offering?.availablePackages.find((each) => each.identifier === planId);

    if (item === undefined) {
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

/** Null for a package shape this app does not sell — a week, a quarter. */
function planOf(item: PurchasesPackage): Plan | null {
  const kind = kindOf(item.packageType);

  if (kind === null) {
    return null;
  }

  const product = item.product;

  return {
    id: item.identifier,
    kind,
    price: product.priceString,
    amount: product.price,
    trialDays: trialDaysOf(item),
  };
}

function kindOf(packageType: PurchasesPackage['packageType']): PlanKind | null {
  if (packageType === PACKAGE_TYPE.MONTHLY) {
    return 'monthly';
  }

  if (packageType === PACKAGE_TYPE.ANNUAL) {
    return 'annual';
  }

  return packageType === PACKAGE_TYPE.LIFETIME ? 'lifetime' : null;
}

/**
 * Whatever free days the store is actually offering, rather than what our copy
 * remembers being configured. Apple decides eligibility per person, and a
 * screen promising a trial to someone who has used theirs is a promise the
 * purchase sheet then breaks.
 */
function trialDaysOf(item: PurchasesPackage): number {
  const period = item.product.introPrice;

  if (period === null || period.price !== 0) {
    return 0;
  }

  const units = period.periodNumberOfUnits;

  switch (period.periodUnit) {
    case 'DAY':
      return units;
    case 'WEEK':
      return units * 7;
    case 'MONTH':
      return units * 30;
    case 'YEAR':
      return units * 365;
    default:
      return 0;
  }
}

function readStatus(info: CustomerInfo): SubscriptionStatus {
  const entitlement = info.entitlements.active[NARRATIVE_ENTITLEMENT];

  if (entitlement === undefined) {
    return { active: false, inTrial: false, renewsAt: null };
  }

  const renewsAt =
    entitlement.expirationDate === null ? null : new Date(entitlement.expirationDate);

  return {
    active: true,
    inTrial: entitlement.periodType === 'TRIAL',
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
