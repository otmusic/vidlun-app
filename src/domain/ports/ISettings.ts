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
