import type { AudioRecording } from './IAudioRecorder';

export interface TranscriptionResult {
  readonly text: string;
  /** 0 to 1. Decides how specific Vidlun may be about what it heard. */
  readonly confidence: number;
}

export interface ITranscriptionService {
  transcribe(recording: AudioRecording): Promise<TranscriptionResult>;
}
