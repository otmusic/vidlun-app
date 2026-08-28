/**
 * `system` follows the phone and keeps following it, so a journal opened at
 * night is dark without anyone having chosen anything. The other two are a
 * decision the person made, and a decision outranks the phone: someone who
 * picked light does not want the evening turning it dark behind their back.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  /** Whether a confirmed entry keeps the take it came from. */
  readonly keepRecordings: boolean;
  readonly locale: 'uk' | 'en';
  readonly theme: ThemeChoice;
  /** False until someone has been told what the app does with their voice. */
  readonly hasOnboarded: boolean;
  /**
   * Whether the card asks for the person's own word before showing Vidlun's.
   * Off leaves the capture path exactly as it was: one card, no question, and
   * nothing to wait for that was not already there.
   */
  readonly asksFirst: boolean;
  /**
   * When the free week started, as an ISO date, or null if it never has. The
   * weekly narrative is the one paid thing in §M5, and until the store exists
   * this is the whole of the entitlement.
   */
  readonly trialStartedAt: string | null;
  /**
   * The evening nudge. Stored here whether or not anything delivers it yet:
   * scheduling a local notification needs `expo-notifications`, which is a
   * dependency to ask about, and the preference is the person's either way.
   */
  readonly reminderOn: boolean;
  /** Local time, 24 hour. */
  readonly reminderHour: number;
  readonly reminderMinute: number;
}

/**
 * Recordings are kept unless the person says otherwise. §1 makes tone part of
 * what a voice journal is for, so the default has to be the one that makes the
 * product work; the setting exists for people who want it off, not as a
 * question everyone has to answer.
 */
export const DEFAULT_SETTINGS: Settings = {
  keepRecordings: true,
  locale: 'uk',
  theme: 'system',
  hasOnboarded: false,
  /*
   * On, because §M6 says finding the word yourself is where the value of the
   * journal is and a setting nobody discovers decides itself. It stays a
   * setting because the same section says the mode is entirely optional.
   */
  asksFirst: true,
  trialStartedAt: null,
  /*
   * Off, and the evening rather than the morning if it is turned on: §8 puts
   * the reminder at the hour someone is usually already home.
   */
  reminderOn: false,
  reminderHour: 21,
  reminderMinute: 0,
};

/**
 * A port with no use case behind it, which is unusual here and deliberate: the
 * composition root reads it to wire the app and the settings screen writes it,
 * while nothing in `application` needs to know a preference exists.
 */
export interface ISettingsStore {
  read(): Promise<Settings>;
  write(settings: Settings): Promise<void>;
}
