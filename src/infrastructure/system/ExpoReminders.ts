import * as Notifications from 'expo-notifications';

import type { IReminders, ReminderPlan } from '../../domain/ports/IReminders';

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
  constructor() {
    /*
     * Without a handler iOS shows nothing while the app is on screen, and the
     * person who just set a reminder two minutes ahead to see it work is
     * exactly the person looking at the app when it fires. Banner only, no
     * sound: they are already in the journal.
     */
    Notifications.setNotificationHandler({
      handleNotification: () =>
        Promise.resolve({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
    });
  }

  async schedule(plan: ReminderPlan): Promise<boolean> {
    await this.cancel();

    if (!(await granted())) {
      return false;
    }

    for (const date of occurrences(plan)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: plan.text.title, body: plan.text.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }

    return true;
  }

  async cancel(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
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

/**
 * Asked for only when there is something to deliver. Requesting permission at
 * launch, before the person has asked to be reminded of anything, is how an
 * app teaches someone to say no to it.
 */
async function granted(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();

  if (existing.granted) {
    return true;
  }

  if (!existing.canAskAgain) {
    return false;
  }

  return (await Notifications.requestPermissionsAsync()).granted;
}
