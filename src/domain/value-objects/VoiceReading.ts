/**
 * What the phone measured in a recording's voice: a handful of numbers about
 * how it sounded, never the sound. Measured from the kept recording, so the
 * numbers stay with the entry after the audio is gone.
 *
 * Each measure is null when the take held too little speech to say anything
 * honest about it. The numbers mean most against the same person's other
 * takes: voices differ far more from one another than one voice does from
 * day to day.
 */
export class VoiceReading {
  /** Raised whenever a measure changes meaning; older readings are measured again. */
  static readonly VERSION = 1;

  private constructor(
    readonly version: number,
    /** How much of the take was speech. */
    readonly speechMs: number,
    /** The voice's usual pitch. */
    readonly pitchHz: number | null,
    /** How far the pitch travels, low tenth to high tenth: flat or lively. */
    readonly pitchRangeSemitones: number | null,
    /** How loud the speech is, in decibels below full scale. */
    readonly loudnessDb: number | null,
    /** How much the loudness swings, low tenth to high tenth. */
    readonly loudnessRangeDb: number | null,
    /** The share of the speaking stretch spent in pauses, 0 to 1. */
    readonly pauseShare: number | null,
    /** Beats a second of speech: how fast, against the person's other takes. */
    readonly pace: number | null,
    /** The voice's mean frequency: brighter is higher. */
    readonly brightnessHz: number | null,
  ) {}

  /**
   * Reads a reading from wherever it was kept or measured. Anything that is
   * not one is null; a number that is not finite is a measure not taken.
   */
  static from(raw: unknown): VoiceReading | null {
    if (typeof raw !== 'object' || raw === null) {
      return null;
    }

    const field = (name: string): number | null => {
      const value: unknown = (raw as Record<string, unknown>)[name];

      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    };
    const version = field('version');
    const speechMs = field('speechMs');

    if (version === null || speechMs === null || speechMs < 0) {
      return null;
    }

    const share = field('pauseShare');

    return new VoiceReading(
      version,
      speechMs,
      positive(field('pitchHz')),
      field('pitchRangeSemitones'),
      field('loudnessDb'),
      field('loudnessRangeDb'),
      share === null ? null : Math.min(1, Math.max(0, share)),
      field('pace'),
      positive(field('brightnessHz')),
    );
  }

  /** False for a take with too little speech in it to measure. */
  get heard(): boolean {
    return this.loudnessDb !== null;
  }

  /** Measured by an older analysis whose numbers mean something else. */
  get stale(): boolean {
    return this.version < VoiceReading.VERSION;
  }

  toJSON(): Record<string, number | null> {
    return {
      version: this.version,
      speechMs: this.speechMs,
      pitchHz: this.pitchHz,
      pitchRangeSemitones: this.pitchRangeSemitones,
      loudnessDb: this.loudnessDb,
      loudnessRangeDb: this.loudnessRangeDb,
      pauseShare: this.pauseShare,
      pace: this.pace,
      brightnessHz: this.brightnessHz,
    };
  }
}

function positive(value: number | null): number | null {
  return value !== null && value > 0 ? value : null;
}
