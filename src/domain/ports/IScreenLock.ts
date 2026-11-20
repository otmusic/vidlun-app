/**
 * What opens the phone, and so the journal's lock: Face ID or Touch ID with
 * the passcode behind them, or the passcode alone.
 */
export type LockMethod = 'face' | 'touch' | 'passcode';

export interface LockReadiness {
  /** Named by what the phone has, even before it is set up. */
  readonly method: LockMethod;
  /** False on a phone with neither biometrics nor a passcode; the switch then refuses. */
  readonly ready: boolean;
}

/** The words the system prompt carries, in the app's language rather than the bundle's. */
export interface UnlockPrompt {
  /** The sentence Touch ID and the passcode show. */
  readonly reason: string;
  readonly cancel: string;
  /** The way to the passcode when Face ID did not recognise the face. */
  readonly fallback: string;
}

/**
 * The lock on the journal's door. The phone owns the key, and the app only
 * ever learns whether the door opened — never a face or a fingerprint.
 */
export interface IScreenLock {
  readiness(): Promise<LockReadiness>;
  unlock(prompt: UnlockPrompt): Promise<boolean>;
}
