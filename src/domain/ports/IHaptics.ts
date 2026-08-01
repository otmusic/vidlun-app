/**
 * Behind a port because §2 lists haptics as platform-sensitive: the Android
 * implementation must be a new adapter, not a fork of a screen.
 *
 * This matters more here than in most apps — the user is often talking and not
 * looking at the screen, so touch is the only channel that reaches them.
 */
export interface IHaptics {
  /** Recording started. */
  tap(): void;
  /** The recorder stopped by itself. */
  settle(): void;
  /** The entry was written. */
  success(): void;
}
