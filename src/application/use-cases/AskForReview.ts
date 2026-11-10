import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IReviewAsks } from '../../domain/ports/IReviewAsks';
import type { IReviewPrompt } from '../../domain/ports/IReviewPrompt';

const IN_A_ROW = 3;

/** The top two steps of the mood scale. */
const GOOD_MOOD = 4;

/**
 * Asks for a rating when the journal has gone well three entries running
 * (owner's word, 2026-11-05): the moment someone is most likely to say the
 * app is worth it, and never one in which asking could cost them anything.
 * The question is put after the save and on home, never inside an entry
 * (2026-10-30). Once a version: Apple keeps its own, stricter count on top,
 * and does not ask someone who has already rated.
 */
export class AskForReview {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly asks: IReviewAsks,
    private readonly prompt: IReviewPrompt,
    /** The installed version; asking is keyed to it. */
    private readonly version: string,
  ) {}

  async isDue(): Promise<boolean> {
    if ((await this.asks.askedIn()) === this.version) {
      return false;
    }

    const latest = await this.repository.findRecent(IN_A_ROW);

    return latest.length === IN_A_ROW && latest.every(wentWell);
  }

  async ask(): Promise<void> {
    await this.asks.remember(this.version);
    await this.prompt.request();
  }
}

/**
 * A day the person called good. A hard entry is never one, whatever it was
 * scored: a rating request right after it would read as not having listened.
 */
function wentWell(entry: MoodEntry): boolean {
  return entry.mood !== null && entry.mood.value >= GOOD_MOOD && entry.safetyFlag === 'none';
}
