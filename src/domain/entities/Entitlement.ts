import type { SubscriptionStatus } from '../ports/IPurchases';

/**
 * What someone is entitled to read, in the three states the screens differ
 * on. Derived from the store's answer and nothing else: a subscription can
 * end, start or refund without this app being open, and any flag we wrote
 * ourselves would outlive the truth.
 *
 * `trial` is distinct because the profile says the free days are running;
 * both it and `subscribed` read in full.
 */
export type Entitlement = 'none' | 'trial' | 'subscribed';

export function entitlementOf(status: SubscriptionStatus): Entitlement {
  if (!status.active) {
    return 'none';
  }

  return status.inTrial ? 'trial' : 'subscribed';
}

/** Whether the whole weekly narrative and the patterns are open. */
export function readsInFull(entitlement: Entitlement): boolean {
  return entitlement !== 'none';
}
