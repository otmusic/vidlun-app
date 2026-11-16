/**
 * Which of the app's two kinds of notification something is. They are
 * scheduled and cancelled apart: the evening reminder is rebuilt every time
 * the app opens, and cancelling everything then took the affirmation with it.
 */
export type NotificationKind = 'reminder' | 'affirmation';

export interface NotificationText {
  readonly title: string;
  readonly body: string;
}

/**
 * The slice of the phone's notifications the app uses. Injected, like the
 * recorder's native half, so the scheduling above it can be tested in plain
 * Node; `expoNotificationCenter` is the real one.
 */
export interface NotificationCenter {
  /** Asks only when it may still ask; false when the person has said no. */
  granted(): Promise<boolean>;
  /** Every pending notification of that kind, and none of the other. */
  cancel(kind: NotificationKind): Promise<void>;
  /** One evening reminder, once. */
  scheduleAt(date: Date, text: NotificationText): Promise<void>;
  /** One morning's affirmation; tapping it opens the cards. */
  scheduleAffirmation(date: Date, text: NotificationText): Promise<void>;
}
