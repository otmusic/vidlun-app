import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

export interface MoodPattern {
  /** The person's own word for it, as the analyzer tagged it. */
  readonly tag: string;
  readonly direction: 'higher' | 'lower';
  /** Entries carrying the tag. The screen says this number out loud. */
  readonly occurrences: number;
  /** How far apart the two averages are, on the 1 to 5 scale. */
  readonly difference: number;
}

export interface FindMoodPatternsInput {
  /** Any day inside the month of interest. Defaults to today. */
  readonly containing?: Date;
}

/**
 * Fewer entries than this and the comparison is anecdote wearing arithmetic.
 * Three is also what the drawing's own example says out loud — "happened three
 * times this month" — so it is the number the copy was written against.
 */
const LEAST_ENTRIES = 3;

/**
 * Under half a point on a five point scale, nobody would notice the difference
 * in their own life and we should not name it.
 */
const LEAST_DIFFERENCE = 0.5;

/**
 * Things that go together in someone's month: entries carrying a tag against
 * entries that do not.
 *
 * **Arithmetic, not a model call.** §3c.5 assumed this needed one, and the
 * pattern the drawing shows — days with a walk score higher, three times this
 * month — is a difference of two averages. A model asked for the same sentence
 * would sometimes produce one that is not true of the data, which §5 says
 * destroys trust in every later insight. Patterns arithmetic cannot reach are
 * still open; this is not the class of them.
 *
 * It reports correlation and the copy must never phrase it as cause. Days with
 * a walk being better days does not mean the walk made them better.
 */
export class FindMoodPatterns {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: FindMoodPatternsInput = {}): Promise<readonly MoodPattern[]> {
    const monthStart = startOfMonth(input.containing ?? this.clock.now());
    /*
     * Only entries that said how the day was. One that did not carries no
     * number to put on either side of the comparison, and standing it in at
     * three would move the average of whichever side it landed on.
     */
    const entries = (await this.repository.findBetween(monthStart, addMonths(monthStart, 1)))
      .filter((entry) => entry.mood !== null);

    if (entries.length < LEAST_ENTRIES * 2) {
      return [];
    }

    const tags = new Set(entries.flatMap((entry) => [...entry.contextTags]));
    const patterns: MoodPattern[] = [];

    for (const tag of tags) {
      const withTag = entries.filter((entry) => entry.contextTags.includes(tag));
      const without = entries.filter((entry) => !entry.contextTags.includes(tag));

      // Both sides need enough in them: a tag on every entry compares a month
      // against nothing.
      if (withTag.length < LEAST_ENTRIES || without.length < LEAST_ENTRIES) {
        continue;
      }

      const difference = averageMood(withTag) - averageMood(without);

      if (Math.abs(difference) < LEAST_DIFFERENCE) {
        continue;
      }

      patterns.push({
        tag,
        direction: difference > 0 ? 'higher' : 'lower',
        occurrences: withTag.length,
        difference: Math.round(Math.abs(difference) * 10) / 10,
      });
    }

    // Widest gap first, and the word breaks a tie so the same month always
    // tells the same story.
    return patterns.sort((a, b) => b.difference - a.difference || a.tag.localeCompare(b.tag));
  }
}

function averageMood(entries: readonly MoodEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.mood?.value ?? 0), 0) / entries.length;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}
