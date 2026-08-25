import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';

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

export interface SpeechThresholds {
  /** Under this, the model has too little audio to place a language at all. */
  readonly detectableFromMs: number;
  /** At or above this, the transcript held up under measurement. */
  readonly reliableFromMs: number;
}

/**
 * Measured on 2026-08-24 against 16 real recordings, not guessed. Word error
 * rate was 1.000 under four seconds, 0.231 between four and eight, and 0.120
 * above eight. See BACKLOG §1b.
 */
export const DEFAULT_SPEECH_THRESHOLDS: SpeechThresholds = {
  detectableFromMs: 4_000,
  reliableFromMs: 8_000,
};

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
      confidence: this.confidenceFor(recording.durationMs),
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

  /**
   * whisper.rn reports no confidence of its own, so it comes from the one
   * predictor that measurement actually supported: how much the user said.
   * Everything downstream leans on this — §6 ties emotion depth to it, and a
   * low score lifts emotions to level 1 and flags the entry for review.
   */
  private confidenceFor(durationMs: number): number {
    if (durationMs >= this.thresholds.reliableFromMs) {
      return 0.9;
    }

    return durationMs >= this.thresholds.detectableFromMs ? 0.65 : 0.3;
  }
}

function clean(transcript: string): string {
  return transcript.replace(NOISE_MARKER, ' ').replace(/\s+/g, ' ').trim();
}
