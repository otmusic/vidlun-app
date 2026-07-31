export interface AudioRecording {
  readonly uri: string;
  readonly durationMs: number;
}

export interface IAudioRecorder {
  start(): Promise<void>;
  /** Resolves when the user stops or the recorder auto-stops on silence. */
  stop(): Promise<AudioRecording>;
  /** Discards the take without producing a recording. */
  cancel(): Promise<void>;
}
