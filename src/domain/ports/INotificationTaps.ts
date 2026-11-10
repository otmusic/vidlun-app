/**
 * Taps on the app's notifications that should open something in it. Only the
 * affirmation does: the evening reminder opens the app where it was.
 */
export interface INotificationTaps {
  /**
   * Calls back on every tap on the affirmation, including the one that
   * launched the app. Returns the way to stop listening.
   */
  listen(onAffirmation: () => void): () => void;
}
