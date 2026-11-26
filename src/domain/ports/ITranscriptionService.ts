import type { AudioRecording } from './IAudioRecorder';

export interface TranscriptionResult {
  readonly text: string;
  /** 0 to 1. Decides how specific Vidlun may be about what it heard. */
  readonly confidence: number;
}

export interface ITranscriptionService {
  /**
   * Get ready to listen, if getting ready costs anything.
   *
   * On the device it does: half a gigabyte of weights has to be read off disk
   * and opened, which takes about ten seconds and is paid by the first take of
   * every session. Called when recording starts rather than when it ends, so
   * the loading happens while the person is still talking and the first entry
   * of the day stops being the slow one.
   *
   * Safe to call repeatedly, and it never fails outward: a warm-up that could
   * break the capture path would be worse than the wait it saves.
   */
  prepare(): Promise<void>;
  transcribe(recording: AudioRecording): Promise<TranscriptionResult>;
  /**
   * Let go of whatever getting ready held. The model is a third of a gigabyte
   * kept in memory, and a phone reclaims memory by killing the app that holds
   * the most of it in the background (memory review, 2026-11-26), month
   * playback included. Called when the app leaves the front; a transcription
   * under way finishes first. The next `prepare` opens it again.
   */
  release(): Promise<void>;
}
