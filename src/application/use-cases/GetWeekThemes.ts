import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

export interface Theme {
  /** The tag as the analyzer wrote it, in the speaker's own language. */
  readonly tag: string;
  /** Entries it was named in, not times it was said. */
  readonly entryCount: number;
}

export interface GetWeekThemesInput {
  readonly weekStart: Date;
  /** Exclusive, matching `GetWeekSummary`. */
  readonly weekEnd: Date;
}

/**
 * How many entries this week mentioned less than this, and it is not a theme
 * yet — it is a thing that happened once. Three is the smallest number that
 * can show a pattern without inviting one.
 */
const LEAST_MENTIONS = 2;

/** The screen has room for three, and a longer list stops being a summary. */
const MOST_THEMES = 3;

/**
 * What the week was about, counted rather than interpreted.
 *
 * Free, unlike the narrative: §M5 puts only the AI prose behind the paywall,
 * and a count of the person's own words is not something to sell back to them.
 */
export class GetWeekThemes {
  constructor(private readonly repository: IMoodEntryRepository) {}

  async execute(input: GetWeekThemesInput): Promise<readonly Theme[]> {
    const entries = await this.repository.findBetween(input.weekStart, input.weekEnd);
    const counts = new Map<string, number>();

    for (const entry of entries) {
      /*
       * Per entry, not per mention. Someone who said "work" three times in one
       * sentence had one day about work, and counting the repetitions would
       * make an emphatic entry look like a week.
       */
      for (const tag of new Set(entry.contextTags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .filter(([, entryCount]) => entryCount >= LEAST_MENTIONS)
      .map(([tag, entryCount]) => ({ tag, entryCount }))
      /*
       * Ties break alphabetically rather than by insertion, so the same week
       * renders the same way twice. A list that reorders itself between visits
       * reads as data changing when nothing has.
       */
      .sort((a, b) => b.entryCount - a.entryCount || a.tag.localeCompare(b.tag))
      .slice(0, MOST_THEMES);
  }
}
