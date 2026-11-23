import type { MoodEntry } from '../../domain/entities/MoodEntry';
import {
  clipsOf,
  MONTH_VOICE_FADE_IN_MS,
  MONTH_VOICE_FADE_OUT_MS,
  MONTH_VOICE_GAP_MS,
  type MonthVoice,
  type MonthVoiceMode,
} from '../../domain/entities/MonthVoice';
import type { IVoiceMontage } from '../../domain/ports/IVoiceMontage';

/** One entry's place in the month as it plays. */
export interface MonthVoicePart {
  readonly entry: MoodEntry;
  readonly startMs: number;
  readonly endMs: number;
}

/** The month joined into one file, and where each entry is in it. */
export interface PlayableMonth {
  readonly uri: string;
  /** In the order they play; a take that could not be read is not among them. */
  readonly parts: readonly MonthVoicePart[];
}

/**
 * The month's takes joined into one file on the phone, ready to play. One
 * file rather than a queue: it plays on with the screen off, and the lock
 * screen shows one player for the month.
 *
 * The file is the person's voice, so it is let go of when the month closes.
 */
export class ComposeMonthVoice {
  constructor(private readonly montage: Pick<IVoiceMontage, 'join' | 'clear'>) {}

  async execute(voice: MonthVoice, mode: MonthVoiceMode): Promise<PlayableMonth | null> {
    const clips = clipsOf(voice, mode);
    const joined = await this.montage.join(
      clips.map((clip) => ({ uri: clip.uri, fromMs: clip.fromMs, toMs: clip.toMs, fadeOut: clip.cut })),
      { gapMs: MONTH_VOICE_GAP_MS, fadeInMs: MONTH_VOICE_FADE_IN_MS, fadeOutMs: MONTH_VOICE_FADE_OUT_MS },
    );

    if (joined === null) {
      return null;
    }

    const parts = clips.flatMap((clip, at): MonthVoicePart[] => {
      const span = joined.spans[at];

      return span === null || span === undefined
        ? []
        : [{ entry: clip.entry, startMs: span.startMs, endMs: span.endMs }];
    });

    return parts.length === 0 ? null : { uri: joined.uri, parts };
  }

  /** Lets the joined file go. Never throws: a file that stays is swept at the next launch. */
  forget(): Promise<void> {
    return this.montage.clear().catch(() => undefined);
  }
}
