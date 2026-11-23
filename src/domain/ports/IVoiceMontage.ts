/** A stretch of one kept take, to be joined with others. */
export interface MontagePiece {
  readonly uri: string;
  readonly fromMs: number;
  readonly toMs: number;
  /** True when the stretch stops before the take does, so it fades out. */
  readonly fadeOut: boolean;
}

/** Where one piece landed in the joined file, in milliseconds. */
export interface MontageSpan {
  readonly startMs: number;
  readonly endMs: number;
}

export interface Montage {
  readonly uri: string;
  /** One per piece, in order; null for a piece that could not be read and was left out. */
  readonly spans: readonly (MontageSpan | null)[];
}

/**
 * Takes joined into one file on the phone, for a month heard in its own
 * voice. The file is the person's voice, so it lives in the app's cache only
 * while the month is open, and is cleared when it closes and at launch.
 */
export interface IVoiceMontage {
  /**
   * Each recording's length in milliseconds, null for one that cannot be
   * read; null altogether where nothing can measure them (tests, a build
   * without the native part).
   */
  lengths(uris: readonly string[]): Promise<readonly (number | null)[] | null>;
  /**
   * The pieces joined, a quiet gap between each. Null where nothing can join
   * them, or when none of the pieces could be read. The same pieces asked
   * again give back the same file without joining it again.
   */
  join(pieces: readonly MontagePiece[], timing: MontageTiming): Promise<Montage | null>;
  /** Removes every joined file. Silent when there is none. */
  clear(): Promise<void>;
}

export interface MontageTiming {
  readonly gapMs: number;
  readonly fadeInMs: number;
  readonly fadeOutMs: number;
}
