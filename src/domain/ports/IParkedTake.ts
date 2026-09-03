import type { AudioRecording } from './IAudioRecorder';

/** A take recorded before the phone could hear, waiting for the day it can. */
export interface ParkedTake {
  readonly recording: AudioRecording;
  /** When it was spoken — the entry belongs to that moment, not to the day it is finally read. */
  readonly recordedAt: Date;
}

/**
 * Keeps one take that could not be transcribed yet.
 *
 * One, not a queue: the person who records twice while the model downloads
 * has said the second thing after the first, and a journal that turns that
 * into a backlog is a queue, not a journal. The newer take replaces the older.
 */
export interface IParkedTake {
  /** Moves the take out of the recorder's scratch space and remembers it. */
  park(recording: AudioRecording, recordedAt: Date): Promise<void>;
  /** Null when nothing waits, or when what waited is no longer on disk. */
  parked(): Promise<ParkedTake | null>;
  /** Silent when there is nothing to clear. */
  clear(): Promise<void>;
}
