import * as Notifications from 'expo-notifications';

import type { INotificationTaps } from '../../domain/ports/INotificationTaps';
import { OPENS_AFFIRMATION } from './expoNotificationCenter';

function opensAffirmation(response: Notifications.NotificationResponse): boolean {
  return response.notification.request.content.data?.['opens'] === OPENS_AFFIRMATION.opens;
}

/**
 * A tap while the app runs arrives as an event; the tap that launched it has
 * already happened by the time anything listens, and waits as the last
 * response. Both open the cards, and each response once: it is cleared when
 * read, and a second report of the same tap is recognised by its date.
 */
export class ExpoNotificationTaps implements INotificationTaps {
  private handled: number | null = null;

  listen(onAffirmation: () => void): () => void {
    const take = (response: Notifications.NotificationResponse | null): void => {
      if (response === null || !opensAffirmation(response)) {
        return;
      }

      if (response.notification.date === this.handled) {
        return;
      }

      this.handled = response.notification.date;
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      onAffirmation();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(take);

    void Notifications.getLastNotificationResponseAsync()
      .then(take)
      .catch(() => undefined);

    return () => {
      subscription.remove();
    };
  }
}
