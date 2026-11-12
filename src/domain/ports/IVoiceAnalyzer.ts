import type { VoiceReading } from '../value-objects/VoiceReading';

/** Measures how a kept recording's voice sounded, on the phone. */
export interface IVoiceAnalyzer {
  /**
   * Null when nothing on this phone can measure a voice — the measuring part
   * is not built in here — so the caller stops asking. Rejects when the one
   * recording cannot be read.
   */
  analyze(recordingUri: string): Promise<VoiceReading | null>;
}
