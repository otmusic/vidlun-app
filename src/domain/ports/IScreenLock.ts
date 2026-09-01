/**
 * The lock on the journal's door. Biometrics first, the device passcode as
 * the fallback — the phone owns both, and the app only ever learns whether
 * the door opened.
 */
export interface IScreenLock {
  /** False on devices with nothing enrolled; the switch then refuses honestly. */
  available(): Promise<boolean>;
  /** Shows the system prompt. `reason` is the sentence in it. */
  unlock(reason: string): Promise<boolean>;
}
