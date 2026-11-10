/** How often the affirmation comes: every morning, on Mondays, or on the first of each month. */
export type AffirmationFrequency = 'daily' | 'weekly' | 'monthly';

export interface AffirmationPlan {
  readonly frequency: AffirmationFrequency;
  readonly text: { readonly title: string; readonly body: string };
}

/**
 * The morning notification that opens the five cards (owner's word,
 * 2026-11-06): the second kind of notification the app sends, beside the
 * evening reminder, and like it switched on by the person in "Me". It
 * repeats on its own rule rather than being refilled: nothing the person does
 * makes one occurrence unwanted, the way an entry already written does for
 * the reminder.
 */
export interface IAffirmationReminders {
  /** False when the phone will not deliver it; the switch should say so. */
  schedule(plan: AffirmationPlan): Promise<boolean>;
  cancel(): Promise<void>;
}
