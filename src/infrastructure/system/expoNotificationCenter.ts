import * as Notifications from 'expo-notifications';

import type { NotificationCenter } from './ExpoReminders';

/** The phone's own notifications, as the reminders need them. */
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
    async cancelAll() {
      await Notifications.cancelAllScheduledNotificationsAsync();
    },
    async scheduleAt(date, text) {
      await Notifications.scheduleNotificationAsync({
        content: { title: text.title, body: text.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    },
  };
}
