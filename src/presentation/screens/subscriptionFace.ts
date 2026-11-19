import type { Entitlement } from '@/domain/entities/Entitlement';
import type { Plan } from '@/domain/ports/IPurchases';

import { planOnSale } from './planOnSale';

/**
 * Which of its four faces the subscription page wears.
 *
 * - `owned`: a receipt, for someone with the trial or the subscription.
 * - `asking`: the store has not answered yet. Nothing to read, buy or retry.
 * - `quiet`: the store answered with nothing to sell.
 * - `offer`: the month, priced.
 */
export type SubscriptionFace =
  | { readonly kind: 'owned' }
  | { readonly kind: 'asking' }
  | { readonly kind: 'quiet' }
  | { readonly kind: 'offer'; readonly plan: Plan };

/**
 * Kept out of the screen, like `planOnSale`, so the rule that a wait is not
 * an empty store can be tested without a renderer. `plans` is null until the
 * store answers.
 */
export function subscriptionFace(
  entitlement: Entitlement,
  plans: readonly Plan[] | null,
): SubscriptionFace {
  // Trial or paid alike: both hold the thing, and both manage it in the store.
  if (entitlement !== 'none') {
    return { kind: 'owned' };
  }

  if (plans === null) {
    return { kind: 'asking' };
  }

  const plan = planOnSale(plans);

  return plan === undefined ? { kind: 'quiet' } : { kind: 'offer', plan };
}
