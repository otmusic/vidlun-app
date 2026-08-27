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
  /** Throws the take away. The promise from `start` rejects. */
  cancel(): void;
}
