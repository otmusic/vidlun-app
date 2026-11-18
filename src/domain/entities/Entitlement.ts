import type { AffirmationFrequency } from '../ports/IAffirmationReminders';
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

/**
 * How many entries a day are free (owner's word, 2026-11-16); with a
 * subscription, or its free trial, there is no limit.
 */
export const FREE_ENTRIES_PER_DAY = 2;

/** Whether one more entry may be started today. */
export function mayWriteAnother(unlimited: boolean, writtenToday: number): boolean {
  return unlimited || writtenToday < FREE_ENTRIES_PER_DAY;
}

/** Whether the monthly narrative and the patterns are open. */
export function readsInFull(entitlement: Entitlement): boolean {
  return entitlement !== 'none';
}

/**
 * How many of the newest entries read without a subscription (owner's word,
 * 2026-11-17): the latest one. Every other entry is still there, by its day
 * and its mood's colour, but its words are under the lock — the same for
 * entries written before the rule as after it.
 */
export const FREE_ENTRIES_OPEN = 1;

/**
 * The ids of the entries whose words read, given the journal newest first;
 * null when every entry reads, with a subscription or its free trial.
 */
export function entriesOpen(
  newestFirst: readonly { readonly id: string }[],
  unlimited: boolean,
): ReadonlySet<string> | null {
  if (unlimited) {
    return null;
  }

  return new Set(newestFirst.slice(0, FREE_ENTRIES_OPEN).map((entry) => entry.id));
}

/**
 * How often the affirmation comes, and so how long a pick is kept: as chosen
 * with a subscription, and monthly without one (owner's word, 2026-11-17 —
 * one affirmation a month is free). The choice itself is left as it was, so
 * subscribing brings it back.
 */
export function affirmationFrequencyFor(
  chosen: AffirmationFrequency,
  unlimited: boolean,
): AffirmationFrequency {
  return unlimited ? chosen : 'monthly';
}
