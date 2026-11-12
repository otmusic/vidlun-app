import type { VoiceCue } from '../value-objects/VoiceCue';

/** What the echo is written from: the entry as the person left it, and how it sounded. */
export interface EchoInput {
  readonly transcript: string;
  /** The mood the person gave the day, 1 to 5; null when they gave none. */
  readonly mood: number | null;
  /** The emotions the person kept, as vocabulary ids. */
  readonly emotionIds: readonly string[];
  /** How the voice sounded against their usual voice; null for a typed entry or too few takes yet. */
  readonly voice: VoiceCue | null;
}

/**
 * Writes the echo: one short sentence Vidlun says back about a saved entry,
 * most of all where the voice and the words go different ways. Null when
 * there is nothing worth saying, which is a fine answer.
 */
export interface IEchoWriter {
  write(input: EchoInput): Promise<string | null>;
}
