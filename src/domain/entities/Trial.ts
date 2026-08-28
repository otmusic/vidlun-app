/**
 * The free week the paywall copy promises, and the only entitlement that
 * exists yet.
 *
 * A date rather than a boolean, because a flag saying "premium" cannot expire
 * and this one has to. The purchase that follows the trial is M5's, and lands
 * behind the same question this answers.
 */
export const TRIAL_DAYS = 7;

/**
 * Null means never started, which is not the same as expired: someone who has
 * not tried it yet is still owed the offer.
 */
export function isTrialLive(startedAt: Date | null, now: Date): boolean {
  if (startedAt === null) {
    return false;
  }

  return now.getTime() - startedAt.getTime() < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

/** True once it ran and ended, so the screen can stop offering what is spent. */
export function isTrialSpent(startedAt: Date | null, now: Date): boolean {
  return startedAt !== null && !isTrialLive(startedAt, now);
}
