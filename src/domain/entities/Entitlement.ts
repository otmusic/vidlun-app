import { isTrialLive, isTrialSpent } from './Trial';

/**
 * What someone is entitled to read, in the four states the screens differ on.
 *
 * `trialSpent` is deliberately not the same as `none`: the offer changes from
 * "seven days free" to "charged right away", and telling someone their trial
 * is available when it is gone would be a promise the store then breaks.
 */
export type Entitlement = 'none' | 'trial' | 'trialSpent' | 'subscribed';

export function entitlementOf(input: {
  readonly subscribed: boolean;
  readonly trialStartedAt: Date | null;
  readonly now: Date;
}): Entitlement {
  // A paid subscription outranks the trial: someone who bought during their
  // free week has bought, and must not be told the week is running out.
  if (input.subscribed) {
    return 'subscribed';
  }

  if (isTrialLive(input.trialStartedAt, input.now)) {
    return 'trial';
  }

  return isTrialSpent(input.trialStartedAt, input.now) ? 'trialSpent' : 'none';
}

/** Whether the whole weekly narrative and the patterns are open. */
export function readsInFull(entitlement: Entitlement): boolean {
  return entitlement === 'trial' || entitlement === 'subscribed';
}
