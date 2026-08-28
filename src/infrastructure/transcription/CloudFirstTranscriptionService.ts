import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';

/** Where a fallback goes. Injected so a test can read it without a console. */
export type ReportFallback = (detail: string) => void;

export const logFallback: ReportFallback = (detail) => {
  /*
   * log, not warn, for the reason recorded in diagnostics/timed.ts: React
   * Native routes warnings into LogBox, which swallows them once its overlay
   * appears — so the one line that says which recogniser answered would go
   * missing exactly during a session spent watching that.
   */
  // eslint-disable-next-line no-console
  console.log(`[vidlun] transcribing on the phone instead: ${detail}`);
};

/**
 * The cloud when it answers, the phone when it does not.
 *
 * There is no connectivity check, and that is the design: a flag saying the
 * radio is up answers a different question from the one that matters, and it
 * is wrong exactly where it costs most — a captive portal, a bar of signal
 * carrying no packets, an airport network that resolves DNS and nothing else.
 * The request itself is the test. It has a deadline, and missing the deadline
 * means the same thing as having no connection: run Parakeet.
 *
 * The price is one timeout on a bad connection, paid before the local model
 * starts. `prepare` covers it by opening Parakeet at the same time either way,
 * so the fallback costs the transcription and not the loading as well.
 */
export class CloudFirstTranscriptionService implements ITranscriptionService {
  constructor(
    private readonly cloud: ITranscriptionService,
    private readonly onDevice: ITranscriptionService,
    private readonly report: ReportFallback = logFallback,
  ) {}

  /**
   * Both, always. Warming the local model on a connection that is about to
   * hold is half a gigabyte read for nothing; not warming it on one that is
   * about to drop puts a ten-second load in front of someone who has already
   * waited out a timeout. The second is the one people would feel.
   */
  async prepare(): Promise<void> {
    try {
      await Promise.all([this.cloud.prepare(), this.onDevice.prepare()]);
    } catch {
      // Getting ready is never allowed to break the capture path — see the
      // contract on ITranscriptionService.prepare.
    }
  }

  async transcribe(recording: AudioRecording): Promise<TranscriptionResult> {
    try {
      const result = await this.cloud.transcribe(recording);

      if (result.text.length > 0) {
        return result;
      }

      /*
       * An empty transcript is not proof that nothing was said — it is equally
       * a cloud that heard nothing in audio the phone can read. Asking Parakeet
       * costs about two seconds on a take that was genuinely silent, and saves
       * an entry from being thrown away on a take that was not.
       */
      this.report('the service returned an empty transcript');
    } catch (error) {
      this.report(error instanceof Error ? error.message : String(error));
    }

    return this.onDevice.transcribe(recording);
  }
}
