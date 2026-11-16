/** How often the affirmation comes: every morning, on Mondays, or on the first of each month. */
export type AffirmationFrequency = 'daily' | 'weekly' | 'monthly';

export interface AffirmationPlan {
  readonly frequency: AffirmationFrequency;
  readonly text: { readonly title: string; readonly body: string };
  /** Now: the mornings scheduled are the ones after it. */
  readonly from: Date;
  /**
   * The end of the period an affirmation is already picked for, or null:
   * no morning before it is notified (owner's word, 2026-11-16).
   */
  readonly quietUntil: Date | null;
}

/**
 * The morning notification that opens the five cards (owner's word,
 * 2026-11-06): the second kind of notification the app sends, beside the
 * evening reminder, and like it switched on by the person in "Me".
 *
 * Refilled like the reminder rather than left to repeat on its own: a pick
 * already made for this period makes its morning unwanted (owner's word,
 * 2026-11-16), so it is rescheduled whenever the app opens, the frequency
 * changes or one is picked.
 */
export interface IAffirmationReminders {
  /** False when the phone will not deliver it; the switch should say so. */
  schedule(plan: AffirmationPlan): Promise<boolean>;
  cancel(): Promise<void>;
}
