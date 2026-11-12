import type { VoiceReading } from '../value-objects/VoiceReading';

/** What was measured in each entry's voice, by entry id. */
export interface IVoiceReadings {
  save(entryId: string, reading: VoiceReading): Promise<void>;
  find(entryId: string): Promise<VoiceReading | null>;
  /** Every reading at once, for a pass over the journal. */
  all(): Promise<ReadonlyMap<string, VoiceReading>>;
  /** Silent when there is none: forgetting twice is not an error. */
  forget(entryId: string): Promise<void>;
  /** Every reading, for when the person has every recording deleted. */
  clear(): Promise<void>;
}
