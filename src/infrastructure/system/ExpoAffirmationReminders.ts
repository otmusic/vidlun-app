import type {
  AffirmationFrequency,
  AffirmationPlan,
  IAffirmationReminders,
} from '../../domain/ports/IAffirmationReminders';
import type { NotificationCenter, RepeatRule } from './NotificationCenter';

/** The first half of the day, settled on ten (owner's choice, 2026-11-06). */
const AT = { hour: 10, minute: 0 } as const;

/** The phone counts Sunday as 1. */
const MONDAY = 2;

/*
 * Monthly comes on the first of the month, not its first Monday (owner's
 * word, 2026-11-06): the pick is kept for the calendar month, so the new
 * month's five should be there the morning it starts.
 */
const RULES: Readonly<Record<AffirmationFrequency, RepeatRule>> = {
  daily: AT,
  weekly: { ...AT, weekday: MONDAY },
  monthly: { ...AT, day: 1 },
};

/**
 * One repeating rule, replaced rather than added to: a change of frequency
 * cancels the old rule before the new one goes in, so two can never stand at
 * once.
 */
export class ExpoAffirmationReminders implements IAffirmationReminders {
  constructor(private readonly center: NotificationCenter) {}

  async schedule(plan: AffirmationPlan): Promise<boolean> {
    await this.center.cancel('affirmation');

    if (!(await this.center.granted())) {
      return false;
    }

    await this.center.scheduleRepeating(RULES[plan.frequency], plan.text);

    return true;
  }

  cancel(): Promise<void> {
    return this.center.cancel('affirmation');
  }
}
