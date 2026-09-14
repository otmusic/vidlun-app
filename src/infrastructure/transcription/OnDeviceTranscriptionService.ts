import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';
import {
  DEFAULT_SPEECH_THRESHOLDS,
  confidenceFor,
  type SpeechThresholds,
} from './speechConfidence';

export { DEFAULT_SPEECH_THRESHOLDS, type SpeechThresholds };

/** The part of whisper.rn's context this adapter drives. */
export interface SpeechEngine {
  transcribe(
    filePath: string,
    options?: { readonly language?: string },
  ): {
    readonly promise: Promise<{
      readonly result: string;
      readonly isAborted: boolean;
    }>;
  };
}

/**
 * Opened on the first take rather than at startup: loading the model costs
 * half a gigabyte of memory and seconds of work, and someone who only ever
 * types should never pay for it.
 */
export type OpenSpeechEngine = () => Promise<SpeechEngine>;

/** The language the user speaks, for takes too short to detect one from. */
export type PreferredLanguage = () => string;

/**
 * whisper.cpp marks a take it heard nothing in, and it does so in the middle
 * of the transcript rather than instead of one.
 */
const NOISE_MARKER = /[[(][^\])]*[\])]/g;

export class OnDeviceTranscriptionService implements ITranscriptionService {
  private engine: Promise<SpeechEngine> | null = null;

  constructor(
    private readonly open: OpenSpeechEngine,
    private readonly preferredLanguage: PreferredLanguage,
    private readonly thresholds: SpeechThresholds = DEFAULT_SPEECH_THRESHOLDS,
  ) {}

  async prepare(): Promise<void> {
    try {
      this.engine ??= this.open();
      await this.engine;
    } catch {
      /*
       * Forget the failed attempt so the next one is allowed to try again, and
       * say nothing: the model may simply not be on disk yet, in which case the
       * app is a working text journal and there is nothing to report.
       */
      this.engine = null;
    }
  }

  async transcribe(recording: AudioRecording): Promise<TranscriptionResult> {
    // Held, not re-opened: the model stays loaded between takes, which is what
    // keeps the second entry of a session fast.
    this.engine ??= this.open();

    const engine = await this.engine;
    const { promise } = engine.transcribe(recording.uri, {
      language: this.languageFor(recording.durationMs),
    });

    const outcome = await promise;

    // A cancelled take produced nothing worth reading, and half a sentence is
    // worse than none: the analyzer cannot tell it was cut off.
    if (outcome.isAborted) {
      return { text: '', confidence: 0 };
    }

    return {
      text: clean(outcome.result),
      confidence: confidenceFor(recording.durationMs, this.thresholds),
    };
  }

  /**
   * Detection is right almost everywhere and fails completely when there is
   * too little audio to decide from: a one-word Ukrainian take came back as
   * English. The app knows which language the user speaks, so on a short take
   * that knowledge beats a guess. On a long one the guess is better, because
   * it can follow a speaker who switched languages mid-sentence.
   */
  private languageFor(durationMs: number): string {
    return durationMs >= this.thresholds.detectableFromMs ? 'auto' : this.preferredLanguage();
  }

}

function clean(transcript: string): string {
  return transcript.replace(NOISE_MARKER, ' ').replace(/\s+/g, ' ').trim();
}
