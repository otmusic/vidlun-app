export interface Settings {
  /** Whether a confirmed entry keeps the take it came from. */
  readonly keepRecordings: boolean;
  readonly locale: 'uk' | 'en';
}

/**
 * Recordings are kept unless the person says otherwise. §1 makes tone part of
 * what a voice journal is for, so the default has to be the one that makes the
 * product work; the setting exists for people who want it off, not as a
 * question everyone has to answer.
 */
export const DEFAULT_SETTINGS: Settings = { keepRecordings: true, locale: 'uk' };

/**
 * A port with no use case behind it, which is unusual here and deliberate: the
 * composition root reads it to wire the app and the settings screen writes it,
 * while nothing in `application` needs to know a preference exists.
 */
export interface ISettingsStore {
  read(): Promise<Settings>;
  write(settings: Settings): Promise<void>;
}
