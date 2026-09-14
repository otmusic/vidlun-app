import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';
import type { AppleSpeech } from '../../../modules/vidlun-speech';
import {
  DEFAULT_SPEECH_THRESHOLDS,
  confidenceFor,
  type SpeechThresholds,
} from './speechConfidence';

/** The one locale the phone is asked to read: English speakers get the phone, everyone else the model. */
export const APPLE_SPEECH_LOCALE = 'en-US';

/**
 * A take read by the phone's own recogniser, on the device, for the language
 * it knows. Nothing here loads weights: the system keeps the language assets
 * and `prepare` only makes sure they are there, so the first take of a
 * session costs what every other one does.
 */
export class AppleTranscriptionService implements ITranscriptionService {
  constructor(
    private readonly speech: AppleSpeech,
    private readonly locale: string = APPLE_SPEECH_LOCALE,
    private readonly thresholds: SpeechThresholds = DEFAULT_SPEECH_THRESHOLDS,
  ) {}

  async prepare(): Promise<void> {
    try {
      await this.speech.prepare(this.locale);
    } catch {
      // The assets may not be installable right now — no network, say — and
      // a warm-up that fails must not break the take; the read itself will say.
    }
  }

  async transcribe(recording: AudioRecording): Promise<TranscriptionResult> {
    const text = await this.speech.transcribe(recording.uri, this.locale);

    return {
      text: text.replace(/\s+/g, ' ').trim(),
      confidence: confidenceFor(recording.durationMs, this.thresholds),
    };
  }
}
