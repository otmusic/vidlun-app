import type { AffirmationFrequency } from './IAffirmationReminders';

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
   * The evening nudge. Stored here whether or not anything delivers it yet:
   * scheduling a local notification needs `expo-notifications`, which is a
   * dependency to ask about, and the preference is the person's either way.
   */
  readonly reminderOn: boolean;
  /** Local time, 24 hour. */
  readonly reminderHour: number;
  readonly reminderMinute: number;
  /**
   * The month whose home card was closed with its X, as "YYYY-MM" (owner's
   * word, 2026-10-06). Only that month's card stays away: the next month's
   * comes on its own first.
   */
  readonly monthCardClosed: string | null;
  /**
   * The App Store version whose update line on home was closed with its X
   * (owner's word, 2026-11-06). Only that version's line stays away: a newer
   * one brings it back.
   */
  readonly updateLineClosed: string | null;
  /** The morning affirmation, off until the person turns it on in "Me". */
  readonly affirmationsOn: boolean;
  readonly affirmationFrequency: AffirmationFrequency;
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
   * Off, and the evening rather than the morning if it is turned on: §8 puts
   * the reminder at the hour someone is usually already home.
   */
  reminderOn: false,
  reminderHour: 21,
  reminderMinute: 0,
  monthCardClosed: null,
  updateLineClosed: null,
  affirmationsOn: false,
  // Weekly by default: the owner's first word for it was "every Monday".
  affirmationFrequency: 'weekly',
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
