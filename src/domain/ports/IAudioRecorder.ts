export interface AudioRecording {
  readonly uri: string;
  readonly durationMs: number;
}

export interface IAudioRecorder {
  /**
   * Starts a take and resolves with it when the user stops it or the recorder
   * reaches the ceiling. One promise per take, because both endings are the
   * same event to the screen waiting on it.
   */
  start(): Promise<AudioRecording>;
  /** Ends the current take early. The promise from `start` resolves. */
  stop(): void;
  /**
   * Holds the current take without ending it: nothing is heard until
   * `resume`, and `stop` or `cancel` still settle it as usual.
   */
  pause(): Promise<void>;
  /** Goes on with a paused take, into the same recording. */
  resume(): Promise<void>;
  /** Throws the take away, its file with it. The promise from `start` rejects. */
  cancel(): void;
  /**
   * Removes a finished take's file if it is still where the recorder left
   * it: a take that was not kept, or whose keeping failed. A kept take has
   * been moved away already, so nothing happens to it; nor while another
   * take is under way.
   */
  discard(uri: string): void;
  /**
   * How loud the voice is right now, from 0 (silence) to 1 (as loud as speech
   * gets); 0 whenever nothing is being heard. The recording screen's bars move
   * with it.
   */
  level(): number;
}
