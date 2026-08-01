/**
 * Timers behind a seam so silence detection can be tested by advancing ticks
 * rather than by waiting in real time.
 */
export interface IScheduler {
  /** Returns a function that stops the repetition. */
  every(intervalMs: number, tick: () => void): () => void;
}

export class IntervalScheduler implements IScheduler {
  every(intervalMs: number, tick: () => void): () => void {
    const handle = setInterval(tick, intervalMs);

    return () => {
      clearInterval(handle);
    };
  }
}
