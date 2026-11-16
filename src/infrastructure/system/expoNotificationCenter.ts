import * as Notifications from 'expo-notifications';

import type { NotificationCenter, NotificationKind } from './NotificationCenter';

/**
 * Every affirmation notification carries this identifier and this data; the
 * identifier is how it is told apart from the reminders when either kind is
 * cancelled, the data how a tap on it is told apart.
 */
export const AFFIRMATION_ID = 'affirmation';
export const OPENS_AFFIRMATION = { opens: 'affirmation' } as const;

/*
 * Reminders scheduled before the affirmation existed carry the phone's own
 * random identifiers, so anything that is not the affirmation counts as a
 * reminder: cancelling the reminders must still clear those.
 */
function kindOf(identifier: string): NotificationKind {
  // The one repeating rule of 1.9, and the mornings scheduled one by one since.
  return identifier === AFFIRMATION_ID || identifier.startsWith(`${AFFIRMATION_ID}-`)
    ? 'affirmation'
    : 'reminder';
}

/** The phone's own notifications, as the reminders and the affirmation need them. */
export function expoNotificationCenter(): NotificationCenter {
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

  return {
    /*
     * Asked for only when there is something to deliver. Requesting
     * permission at launch, before the person has asked to be reminded of
     * anything, is how an app teaches someone to say no to it.
     */
    async granted() {
      const existing = await Notifications.getPermissionsAsync();

      if (existing.granted) {
        return true;
      }

      if (!existing.canAskAgain) {
        return false;
      }

      return (await Notifications.requestPermissionsAsync()).granted;
    },
    async cancel(kind) {
      const pending = await Notifications.getAllScheduledNotificationsAsync();

      for (const request of pending) {
        if (kindOf(request.identifier) === kind) {
          await Notifications.cancelScheduledNotificationAsync(request.identifier);
        }
      }
    },
    async scheduleAt(date, text) {
      await Notifications.scheduleNotificationAsync({
        content: { title: text.title, body: text.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    },
    async scheduleAffirmation(date, text) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${AFFIRMATION_ID}-${date.getTime()}`,
        content: { title: text.title, body: text.body, data: OPENS_AFFIRMATION },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    },
  };
}
