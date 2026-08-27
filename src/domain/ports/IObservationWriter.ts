/**
 * The one sentence Vidlun says out loud, kept apart from the classification it
 * used to travel with. §4 asks for small ports that change independently, and
 * these two now differ in every way that matters: a different model writes
 * this, prose rather than ids, and the card renders without it.
 */
export interface IObservationWriter {
  /** Null whenever there is nothing worth saying, which is often. */
  observe(transcript: string): Promise<string | null>;
}
