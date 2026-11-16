import type {
  AffirmationFrequency,
  AffirmationPlan,
  IAffirmationReminders,
} from '../../domain/ports/IAffirmationReminders';
import type { NotificationCenter } from './NotificationCenter';

/** The first half of the day, settled on ten (owner's choice, 2026-11-06). */
const AT = { hour: 10, minute: 0 } as const;

/**
 * How many mornings stand scheduled at once: enough to last until the app is
 * opened again, few enough to stay well inside the phone's sixty-four, which
 * the evening reminders share.
 */
const AHEAD: Readonly<Record<AffirmationFrequency, number>> = {
  daily: 14,
  weekly: 8,
  monthly: 6,
};

/**
 * The mornings an affirmation comes on, after `from`: every day, every
 * Monday, or the first of every month (owner's word, 2026-11-06: the month's
 * five should be there the morning it starts), at ten. A morning before
 * `quietUntil` is left out, since its affirmation is already picked.
 */
export function affirmationMornings(
  frequency: AffirmationFrequency,
  from: Date,
  quietUntil: Date | null,
): readonly Date[] {
  const mornings: Date[] = [];
  let day = new Date(from.getFullYear(), from.getMonth(), from.getDate(), AT.hour, AT.minute);

  while (mornings.length < AHEAD[frequency]) {
    const due =
      day.getTime() > from.getTime() &&
      (quietUntil === null || day.getTime() >= quietUntil.getTime()) &&
      (frequency === 'daily' ||
        (frequency === 'weekly' && day.getDay() === 1) ||
        (frequency === 'monthly' && day.getDate() === 1));

    if (due) {
      mornings.push(day);
    }

    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, AT.hour, AT.minute);
  }

  return mornings;
}

/**
 * The mornings ahead, replaced as a whole on every schedule, the requests
 * taking turns as the evening reminder's do: run side by side, the second's
 * cancel would land among the first's mornings and leave some twice.
 */
export class ExpoAffirmationReminders implements IAffirmationReminders {
  private turn: Promise<unknown> = Promise.resolve();
  private newest = 0;

  constructor(private readonly center: NotificationCenter) {}

  schedule(plan: AffirmationPlan): Promise<boolean> {
    const mine = this.ask();

    return this.inTurn(async () => {
      // Overtaken while waiting: the newer request says what stands.
      if (mine !== this.newest) {
        return true;
      }

      await this.center.cancel('affirmation');

      if (!(await this.center.granted())) {
        return false;
      }

      for (const morning of affirmationMornings(plan.frequency, plan.from, plan.quietUntil)) {
        await this.center.scheduleAffirmation(morning, plan.text);
      }

      return true;
    });
  }

  cancel(): Promise<void> {
    this.ask();

    return this.inTurn(() => this.center.cancel('affirmation'));
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
