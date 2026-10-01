import type { IObservationWriter } from '../../domain/ports/IObservationWriter';

/**
 * Slower than the pretend analysis on purpose: the real echo comes from a
 * slower model, and the case worth walking is the one where the entry is
 * already saved when the echo lands.
 */
const DEFAULT_DELAY_MS = 8000;

/**
 * An echo that answers without the network, for walking the paid card in
 * the simulator alongside `FakeReflectionAnalyzer`. Plainly marked as
 * pretend, so nobody reads it as Vidlun's voice.
 *
 * **Development only, and behind the same flag**: a release build must never
 * answer someone's words with a made-up sentence.
 */
export class FakeObservationWriter implements IObservationWriter {
  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  observe(transcript: string): Promise<string | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`Pretend echo, written after the save: "${transcript.slice(0, 40)}"`);
      }, this.delayMs);
    });
  }
}
