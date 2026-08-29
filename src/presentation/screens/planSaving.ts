import type { Plan } from '@/domain/ports/IPurchases';

/**
 * What the year saves against twelve months, rounded down. Null on anything
 * that is not the year, and null when there is no month to compare with —
 * a discount against nothing is a number we made up.
 *
 * Its own file rather than a helper inside the screen: this is the one piece
 * of the paywall that states a fact about money, and it is worth being able to
 * test it without a renderer.
 */
export function savingAgainstMonthly(plan: Plan, plans: readonly Plan[]): number | null {
  if (plan.kind !== 'annual') {
    return null;
  }

  const monthly = plans.find((each) => each.kind === 'monthly');

  if (monthly === undefined || monthly.amount <= 0) {
    return null;
  }

  const saving = Math.floor((1 - plan.amount / (monthly.amount * 12)) * 100);

  return saving > 0 ? saving : null;
}
