import type { IReminders, ReminderPlan } from '../../domain/ports/IReminders';

/**
 * The slice of the phone's notifications the reminders use. Injected, like
 * the recorder's native half, so the queue below can be tested in plain Node;
 * `expoNotificationCenter` is the real one.
 */
export interface NotificationCenter {
  /** Asks only when it may still ask; false when the person has said no. */
  granted(): Promise<boolean>;
  cancelAll(): Promise<void>;
  scheduleAt(date: Date, text: { readonly title: string; readonly body: string }): Promise<void>;
}

/**
 * A week of one-off notifications, replaced rather than added to.
 *
 * Seven is enough that someone who does not open the app for days still gets
 * reminded, and short enough that a change of mind about the time takes effect
 * within the week. Every one is cancelled before any is scheduled: the only
 * bug this class can have that a person would notice is two arriving at once,
 * and it is the kind that accumulates silently across setting changes.
 */
const DAYS_AHEAD = 7;

export class ExpoReminders implements IReminders {
  /*
   * One request at a time, and only the newest counts. Opening the app asks
   * twice within a moment — the settings, then the journal once it has
   * loaded — and each ask is a cancel followed by eight separate schedules.
   * Run side by side, the second's cancel landed in the middle of the first's
   * schedules, and the evenings the first had not reached yet were scheduled
   * by both: two notifications at nine (owner's phone, 2026-09-17).
   */
  private turn: Promise<unknown> = Promise.resolve();
  private newest = 0;

  constructor(private readonly center: NotificationCenter) {}

  schedule(plan: ReminderPlan): Promise<boolean> {
    const mine = this.ask();

    return this.inTurn(async () => {
      // Overtaken while waiting: the newer request will say what stands.
      // True, because nothing was refused — only the last answer is one.
      if (mine !== this.newest) {
        return true;
      }

      await this.center.cancelAll();

      if (!(await this.center.granted())) {
        return false;
      }

      for (const date of occurrences(plan)) {
        await this.center.scheduleAt(date, plan.text);
      }

      return true;
    });
  }

  cancel(): Promise<void> {
    this.ask();

    return this.inTurn(() => this.center.cancelAll());
  }

  private ask(): number {
    this.newest += 1;

    return this.newest;
  }

  /** Runs after whatever is already running, whether that ended well or not. */
  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const mine = this.turn.then(work, work);

    this.turn = mine.catch(() => undefined);

    return mine;
  }
}

/**
 * The next several evenings, minus tonight where tonight has been earned or
 * has already passed. A notification scheduled for a moment in the past never
 * arrives, so leaving it in would quietly shorten the queue by one.
 */
function occurrences(plan: ReminderPlan): readonly Date[] {
  const dates: Date[] = [];

  for (let day = 0; day <= DAYS_AHEAD; day += 1) {
    const at = new Date(plan.now.getFullYear(), plan.now.getMonth(), plan.now.getDate() + day);

    at.setHours(plan.at.hour, plan.at.minute, 0, 0);

    if (day === 0 && (plan.skipToday || at <= plan.now)) {
      continue;
    }

    dates.push(at);
  }

  return dates;
}
