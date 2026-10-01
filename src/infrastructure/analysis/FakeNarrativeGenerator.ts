import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';

/** About what Sonnet takes, so the page's writing state is seen. */
const DEFAULT_DELAY_MS = 2500;

/**
 * A month written back without the network, for walking the month page in
 * the simulator alongside `FakeReflectionAnalyzer`. Plainly marked as
 * pretend, and wired without the cache, so a pretend month is never stored
 * where a real build would read it back.
 *
 * **Development only, and behind the same flag**: a release build must never
 * show someone a made-up account of their month.
 */
export class FakeNarrativeGenerator implements INarrativeGenerator {
  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  generate(entries: readonly MoodEntry[]): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          `Pretend month, written from ${String(entries.length)} entries.\n` +
            'A second paragraph, so the page shows how the prose breaks.',
        );
      }, this.delayMs);
    });
  }
}
