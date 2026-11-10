/**
 * Which of the app's two kinds of notification something is. They are
 * scheduled and cancelled apart: the evening reminder is rebuilt every time
 * the app opens, and cancelling everything then took the affirmation with it.
 */
export type NotificationKind = 'reminder' | 'affirmation';

/**
 * A time that comes round again: every day at `hour:minute`, every `weekday`
 * (1 is Sunday, as the phone counts) when one is given, or on that `day` of
 * every month when that is given instead.
 */
export interface RepeatRule {
  readonly hour: number;
  readonly minute: number;
  readonly weekday?: number;
  readonly day?: number;
}

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
  /** The affirmation, again and again; tapping it opens the cards. */
  scheduleRepeating(rule: RepeatRule, text: NotificationText): Promise<void>;
}
