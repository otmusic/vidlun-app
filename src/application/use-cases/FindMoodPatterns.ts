import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

/** The two ends of the month: its good or high days, and its low or very low ones. */
export type PatternSide = 'best' | 'hardest';

/**
 * What the month's best or hardest days had in common: one topic, on most of
 * them, and on far fewer of the other days.
 */
export interface DaysPattern {
  readonly kind: 'days';
  readonly side: PatternSide;
  /** The person's own word for it, as the analyzer tagged it. */
  readonly tag: string;
  /** The days on that side that carried the tag. */
  readonly matching: number;
  /** The days on that side. */
  readonly total: number;
  /** Every entry of the matching days, for "see these days". */
  readonly entryIds: readonly string[];
}

/**
 * The emotion that keeps company with a topic: named on most of the entries
 * carrying it, and on far fewer of the rest.
 */
export interface CompanionPattern {
  readonly kind: 'companion';
  readonly tag: string;
  readonly emotionId: string;
  /** The topic's entries that named the emotion. */
  readonly matching: number;
  /** The topic's entries. */
  readonly total: number;
  readonly entryIds: readonly string[];
}

export type MoodPattern = DaysPattern | CompanionPattern;

export interface FindMoodPatternsInput {
  /** Any day inside the month of interest. Defaults to today. */
  readonly containing?: Date;
}

/**
 * Fewer than this on either side of a comparison and it is anecdote wearing
 * arithmetic.
 */
const LEAST = 3;

/**
 * The scale's words, not its numbers: the person picks "Good" or "High",
 * never a 4. The same bands the scale's colours use — 4 and 5 the good end,
 * 1 and 2 the low one, 3 even and on neither side.
 */
const GOOD_FROM = 4;
const LOW_UP_TO = 2;

/**
 * A third between the two groups. In a month of ten or so days, anything
 * smaller turns over when one day lands the other way.
 */
const LEAST_GAP = 1 / 3;

/**
 * What went together in someone's month, in two sentences at most (owner's
 * word, 2026-10-14):
 *
 * 1. **From the days to the topic.** The month's hardest days, or its best,
 *    and the topic most of them carried: "all three hardest days had work".
 *    This answers the question a person actually brings to their month —
 *    what was going on on the bad days — rather than asking them to read a
 *    comparison of two groups of entries.
 * 2. **From the topic to the emotion.** The emotion named next to a topic on
 *    most of its entries, the first sentence's topic when it has one. It
 *    speaks in the person's own words for the feeling, which a mood never did.
 *
 * Days, not entries, on the first: two entries on one bad day are one bad day.
 * A day is on the hard side if any of its entries was low, on the good side
 * if any was good, and carries a topic if any of its entries did.
 *
 * **Arithmetic, not a model call.** A model asked for the same sentence would
 * sometimes produce one that is not true of the data, which §5 says destroys
 * trust in every later insight. And it is correlation: the copy says what came
 * together and never that one caused the other.
 */
export class FindMoodPatterns {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: FindMoodPatternsInput = {}): Promise<readonly MoodPattern[]> {
    const monthStart = startOfMonth(input.containing ?? this.clock.now());
    // Oldest first, so the days and the ids for "see these days" come in calendar order.
    const entries = [...(await this.repository.findBetween(monthStart, addMonths(monthStart, 1)))].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const days = daysPatternOf(entries);
    const companion = companionOf(entries, days?.tag ?? null);

    return [days, companion].filter((each): each is MoodPattern => each !== null);
  }
}

interface Day {
  readonly entries: readonly MoodEntry[];
  readonly tags: ReadonlySet<string>;
  readonly hard: boolean;
  readonly good: boolean;
}

function daysPatternOf(entries: readonly MoodEntry[]): DaysPattern | null {
  const days = daysOf(entries.filter((entry) => entry.mood !== null));
  let found: { readonly pattern: DaysPattern; readonly gap: number } | null = null;

  // Hardest first, so that at an equal gap the heavy end is the one named.
  for (const side of ['hardest', 'best'] as const) {
    const onSide = days.filter((day) => (side === 'hardest' ? day.hard : day.good));
    const rest = days.filter((day) => (side === 'hardest' ? !day.hard : !day.good));

    if (onSide.length < LEAST || rest.length < LEAST) {
      continue;
    }

    for (const tag of new Set(onSide.flatMap((day) => [...day.tags]))) {
      const matching = onSide.filter((day) => day.tags.has(tag));
      const gap =
        matching.length / onSide.length - rest.filter((day) => day.tags.has(tag)).length / rest.length;

      if (matching.length * 2 <= onSide.length || gap < LEAST_GAP) {
        continue;
      }

      if (found === null || isBetter(gap, matching.length, tag, found)) {
        found = {
          gap,
          pattern: {
            kind: 'days',
            side,
            tag,
            matching: matching.length,
            total: onSide.length,
            entryIds: matching.flatMap((day) => day.entries.map((entry) => entry.id)),
          },
        };
      }
    }
  }

  return found?.pattern ?? null;
}

/**
 * The first sentence's topic when it has one; otherwise the topic whose
 * companion is plainest. An emotion that sits beside everything says nothing
 * about the topic, so it must be a third more common with it than without.
 */
function companionOf(entries: readonly MoodEntry[], preferred: string | null): CompanionPattern | null {
  const tags = [...new Set(entries.flatMap((entry) => [...entry.contextTags]))];
  const ordered = preferred === null ? tags : [preferred, ...tags.filter((tag) => tag !== preferred)];
  let found: { readonly pattern: CompanionPattern; readonly gap: number } | null = null;

  for (const tag of ordered) {
    const withTag = entries.filter((entry) => entry.contextTags.includes(tag));
    const others = entries.filter((entry) => !entry.contextTags.includes(tag));

    if (withTag.length < LEAST || others.length < LEAST) {
      continue;
    }

    for (const emotionId of new Set(withTag.flatMap((entry) => [...entry.emotionIds]))) {
      const matching = withTag.filter((entry) => entry.emotionIds.includes(emotionId));
      const gap =
        matching.length / withTag.length -
        others.filter((entry) => entry.emotionIds.includes(emotionId)).length / others.length;

      if (matching.length * 2 <= withTag.length || gap < LEAST_GAP) {
        continue;
      }

      if (found === null || isBetter(gap, matching.length, `${tag} ${emotionId}`, found)) {
        found = {
          gap,
          pattern: {
            kind: 'companion',
            tag,
            emotionId,
            matching: matching.length,
            total: withTag.length,
            entryIds: matching.map((entry) => entry.id),
          },
        };
      }
    }

    // The first sentence's topic, when it has a companion, is the one that
    // reads as a continuation; a plainer pair elsewhere would read as a jump.
    if (tag === preferred && found !== null) {
      return found.pattern;
    }
  }

  return found?.pattern ?? null;
}

/**
 * Widest gap first, then the larger count, then the word, so the same month
 * always tells the same story.
 */
function isBetter(
  gap: number,
  count: number,
  key: string,
  current: { readonly gap: number; readonly pattern: MoodPattern },
): boolean {
  const currentKey =
    current.pattern.kind === 'days'
      ? current.pattern.tag
      : `${current.pattern.tag} ${current.pattern.emotionId}`;

  return (
    gap > current.gap + 1e-9 ||
    (Math.abs(gap - current.gap) <= 1e-9 &&
      (count > current.pattern.matching ||
        (count === current.pattern.matching && key.localeCompare(currentKey) < 0)))
  );
}

/** Entries grouped by the local day they were written on, oldest first. */
function daysOf(entries: readonly MoodEntry[]): readonly Day[] {
  const byDay = new Map<string, MoodEntry[]>();

  for (const entry of entries) {
    const at = entry.createdAt;
    const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;

    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  return [...byDay.values()].map((group) => ({
    entries: group,
    tags: new Set(group.flatMap((entry) => [...entry.contextTags])),
    hard: group.some((entry) => (entry.mood?.value ?? GOOD_FROM) <= LOW_UP_TO),
    good: group.some((entry) => (entry.mood?.value ?? 0) >= GOOD_FROM),
  }));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}
