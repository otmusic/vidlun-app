/** Local time, 24 hour, as the person set it. */
export interface ReminderTime {
  readonly hour: number;
  readonly minute: number;
}

export interface ReminderPlan {
  readonly at: ReminderTime;
  readonly text: { readonly title: string; readonly body: string };
  /** Today, so the adapter needs no clock of its own. */
  readonly now: Date;
  /**
   * True when today already holds an entry. A reminder to do the thing you
   * have just done is the app not paying attention, and §8 is clear that the
   * nudge exists to help rather than to be counted.
   */
  readonly skipToday: boolean;
}

/**
 * The evening nudge, and nothing else.
 *
 * One reminder exists, so this has no ids and no list: setting it replaces
 * whatever was there and clearing it removes the lot. A second kind of
 * notification would be a decision in the brief before it is a method here —
 * §8 is explicit that this must not become an app that pesters.
 *
 * **Days ahead rather than a repeating rule.** A daily trigger cannot skip an
 * occurrence, and skipping is the whole point: the queue is refilled whenever
 * the app opens, so someone who stops opening it still gets a week of
 * reminders and someone who wrote today does not get one tonight.
 */
export interface IReminders {
  /**
   * True when the phone will actually deliver them. False is a normal answer
   * rather than an error: someone may decline, and the setting still records
   * what they asked for.
   */
  schedule(plan: ReminderPlan): Promise<boolean>;
  cancel(): Promise<void>;
}
