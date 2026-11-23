import type { MoodEntry } from './MoodEntry';

/**
 * A month heard in its own voice (owner's word, 2026-11-23): every entry of
 * the month that kept its voice, first to last, as one piece to listen to.
 *
 * Two ways to hear it. `glimpse`: the first seconds of each take, so the
 * whole month passes in a few minutes. `whole`: every take in full.
 */
export type MonthVoiceMode = 'glimpse' | 'whole';

/** How much of each take a glimpse plays: usually a sentence or two. */
export const GLIMPSE_MS = 10_000;

/** The quiet between two takes, so the days do not run into each other. */
export const MONTH_VOICE_GAP_MS = 700;

/** How a take comes in, and how a glimpse cut short goes out rather than breaking off. */
export const MONTH_VOICE_FADE_IN_MS = 80;
export const MONTH_VOICE_FADE_OUT_MS = 600;

/** An entry of the month with its kept take, and how long the take runs. */
export interface VoicedEntry {
  readonly entry: MoodEntry;
  readonly uri: string;
  readonly lengthMs: number;
}

export interface MonthVoice {
  /** Midnight on the first of the month. */
  readonly monthStart: Date;
  /**
   * Oldest first, as the month went: every entry that kept its voice, the
   * hard ones too (owner's word, 2026-11-23).
   */
  readonly voiced: readonly VoicedEntry[];
}

/** A stretch of one take, as it goes into the month. */
export interface MonthVoiceClip {
  readonly entry: MoodEntry;
  readonly uri: string;
  readonly fromMs: number;
  readonly toMs: number;
  /** True when the stretch stops before the take does. */
  readonly cut: boolean;
}

/** The stretches of each take the mode plays, in the month's order. */
export function clipsOf(voice: MonthVoice, mode: MonthVoiceMode): readonly MonthVoiceClip[] {
  return voice.voiced.map(({ entry, uri, lengthMs }) => {
    const toMs = mode === 'glimpse' ? Math.min(lengthMs, GLIMPSE_MS) : lengthMs;

    return { entry, uri, fromMs: 0, toMs, cut: toMs < lengthMs };
  });
}

/** How long the month plays in a mode, the gaps between takes included. */
export function lengthOf(voice: MonthVoice, mode: MonthVoiceMode): number {
  const clips = clipsOf(voice, mode);
  const sound = clips.reduce((sum, clip) => sum + (clip.toMs - clip.fromMs), 0);

  return sound + Math.max(0, clips.length - 1) * MONTH_VOICE_GAP_MS;
}
