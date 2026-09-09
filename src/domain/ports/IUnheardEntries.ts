/**
 * The entries Vidlun could not listen to when they were made — the network
 * was down, or slow past patience — kept by id until it can.
 *
 * A list rather than one slot, unlike the parked take: each of these is
 * already a saved entry with the person's own words in it, and hearing them
 * late changes nothing about their order in the journal.
 */
export interface IUnheardEntries {
  add(entryId: string): Promise<void>;
  /** Oldest first. */
  ids(): Promise<readonly string[]>;
  /** Silent when the id is not there. */
  remove(entryId: string): Promise<void>;
}
