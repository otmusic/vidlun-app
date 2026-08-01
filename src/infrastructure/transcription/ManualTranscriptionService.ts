import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';

/**
 * The transcript comes from the keyboard rather than the microphone.
 *
 * Two jobs: it stands in for Whisper so the rest of the capture path can be
 * exercised on a device before the speech model exists, and it is the text
 * fallback for people who cannot speak right now. Confidence is 1 because a
 * human typed the words; nothing was heard and so nothing was misheard.
 */
export class ManualTranscriptionService implements ITranscriptionService {
  private text = '';

  setTranscript(text: string): void {
    this.text = text;
  }

  transcribe(): Promise<TranscriptionResult> {
    return Promise.resolve({ text: this.text, confidence: 1 });
  }
}
