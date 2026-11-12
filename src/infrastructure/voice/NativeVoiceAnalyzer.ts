import type { IVoiceAnalyzer } from '../../domain/ports/IVoiceAnalyzer';
import { VoiceReading } from '../../domain/value-objects/VoiceReading';
import { InvalidVoiceReadingError } from '../../domain/errors/VoiceErrors';

/** The native measuring call, or null where it is not built in. */
export type AnalyzeVoice = (uri: string) => Promise<Record<string, unknown>> | null;

/**
 * The phone's own measuring, in Swift with Accelerate (`modules/vidlun-voice`):
 * off the JavaScript thread, a minute of speech in a few hundredths of a
 * second. Passed in as a function so this stays testable without a device.
 */
export class NativeVoiceAnalyzer implements IVoiceAnalyzer {
  constructor(private readonly analyzeVoice: AnalyzeVoice) {}

  async analyze(recordingUri: string): Promise<VoiceReading | null> {
    const measuring = this.analyzeVoice(recordingUri);

    if (measuring === null) {
      return null;
    }

    const reading = VoiceReading.from(await measuring);

    if (reading === null) {
      throw new InvalidVoiceReadingError();
    }

    return reading;
  }
}
