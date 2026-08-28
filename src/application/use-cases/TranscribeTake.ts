import { NothingWasSaidError } from '../../domain/errors/MoodEntryErrors';
import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type { ITranscriptionService } from '../../domain/ports/ITranscriptionService';
import { Confidence } from '../../domain/value-objects/Confidence';

export interface Spoken {
  readonly text: string;
  readonly confidence: Confidence;
}

/**
 * The words, on their own, before anything has been decided about them.
 *
 * Split out of `CreateVoiceEntry` so the card can ask its question the moment
 * the transcript exists rather than after the analysis returns. The person
 * reads their own sentence and answers while Vidlun is still working, which is
 * the whole reason the question costs the capture path no wait.
 */
export class TranscribeTake {
  constructor(private readonly transcription: ITranscriptionService) {}

  /**
   * Called when the recording starts, not when it ends. The model takes about
   * ten seconds to open and that used to land on whoever spoke first each
   * session; opening it while they are still talking hides the whole of it.
   */
  async prepare(): Promise<void> {
    await this.transcription.prepare();
  }

  async execute(recording: AudioRecording): Promise<Spoken> {
    const result = await this.transcription.transcribe(recording);
    const text = result.text.trim();

    if (text.length === 0) {
      throw new NothingWasSaidError();
    }

    return { text, confidence: Confidence.clamped(result.confidence) };
  }
}
