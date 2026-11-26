/**
 * How long the card waits for Vidlun's reading before it goes up without it.
 *
 * A reading takes about two seconds on a working network. The client gives
 * one attempt twenty seconds and a second try, and the daily token renewal
 * can come first, so on a weak network the processing screen used to stay
 * up for forty to seventy seconds (performance review, 2026-11-26). Past this
 * the card goes on as when the network is down: the person's own answer is
 * saved and Vidlun's is listened for later.
 */
export const CARD_DEADLINE_MS = 8_000;

/** The reading did not arrive in time; the card goes on without it. */
export class DeadlinePassedError extends Error {
  constructor(readonly afterMs: number) {
    super(`No answer within ${afterMs} ms.`);
    this.name = 'DeadlinePassedError';
  }
}

/**
 * The work's own answer if it comes within `ms`, a DeadlinePassedError if it
 * does not. The work itself goes on; only the wait for it ends.
 */
export function withinDeadline<T>(work: Promise<T>, ms: number = CARD_DEADLINE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DeadlinePassedError(ms));
    }, ms);

    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
