import type { Plan } from '@/domain/ports/IPurchases';

/**
 * The one plan the paywall sells: the month (owner's word, 2026-10-23). The
 * store may still price the year and the lifetime — they stay configured, and
 * whoever bought one keeps what it gave — but they are not offered for now.
 * Undefined when the store prices no month, which the screen treats like a
 * store with nothing to sell.
 *
 * Its own file rather than a line inside the screen, so the rule about what
 * is on sale can be tested without a renderer.
 */
export function planOnSale(plans: readonly Plan[]): Plan | undefined {
  return plans.find((plan) => plan.kind === 'monthly');
}
