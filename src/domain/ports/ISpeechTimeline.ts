/** A stretch of a recording where someone is speaking, between pauses. */
export interface SpeechSpan {
  readonly fromMs: number;
  readonly toMs: number;
}

/**
 * Where the speech is in a kept recording, measured on the phone from the
 * file. Nothing is stored: it is read again whenever it is wanted.
 */
export interface ISpeechTimeline {
  /** Null where nothing can read the file, or the platform has no reader. */
  spans(recordingUri: string): Promise<readonly SpeechSpan[] | null>;
}
