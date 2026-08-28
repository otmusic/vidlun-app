import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';

/** One word traded for a more exact one: tired, and now exhausted. */
export interface RefinementPair {
  readonly fromId: string;
  readonly toId: string;
}

/** How many different words one month held, for the line across the period. */
export interface MonthlyDistinct {
  /** Midnight on the first of that month. */
  readonly monthStart: Date;
  readonly distinctCount: number;
}

/**
 * A broad word the person started the period with, and the several finer ones
 * they ended it with. Both halves are measured: the root is one they actually
 * used, and the words it opened into are ones they actually used later.
 */
export interface Widening {
  readonly rootId: string;
  /** Descendants of that root, named later in the period. Never fewer than two. */
  readonly intoIds: readonly string[];
}

export interface VocabularyGrowth {
  /** The period this describes: `from` inclusive, `to` exclusive. */
  readonly from: Date;
  readonly to: Date;
  /**
   * True when the period covers more than one month. The copy differs — first
   * time this month against first time in this period — and only the screen
   * knows which of the two reads right.
   */
  readonly wide: boolean;
  /** One entry per month the period touches, oldest first. */
  readonly months: readonly MonthlyDistinct[];
  /** Named this month and in no month before it. */
  readonly firstTimeIds: readonly string[];
  /** A broad word used earlier, a child of it used now. */
  readonly refinements: readonly RefinementPair[];
  /** How many different words this month, however deep. */
  readonly distinctCount: number;
  /** Of those, how many were more than a root word. */
  readonly preciseCount: number;
  /**
   * Null unless a root the person used at the start of the period really did
   * open into several finer words by the end of it. The screen then says
   * nothing rather than saying it of a word nobody used.
   */
  readonly widening: Widening | null;
  /**
   * False when there is nothing yet to say, which is most of the first month.
   * The screen shows its quiet copy rather than a row of zeroes.
   */
  readonly hasAnything: boolean;
}

export interface GetVocabularyGrowthInput {
  /** Inclusive. Defaults to the first of the month `to` ends in. */
  readonly from?: Date;
  /** Exclusive. Defaults to tomorrow, so today's entries are counted. */
  readonly to?: Date;
}

/** A root word. Everything below it is the person distinguishing something. */
const ROOT_DEPTH = 1;

/** Three fit the screen, and a longer list stops being a thing you notice. */
const MOST_PAIRS = 3;

/**
 * How the person's own language is changing — §M6's core value signal, and the
 * half of the insights screen this product actually exists for.
 *
 * **Read from `selfEmotionIds` and nothing else.** After the reveal the kept
 * set is a mix of what the person found and what they adopted from Vidlun, so
 * counting it would measure our vocabulary and call it theirs. That is the
 * whole reason §3b keeps three separate fields. The price is that entries made
 * with the question switched off say nothing here, which is correct: they hold
 * no unaided answer to count.
 */
export class GetVocabularyGrowth {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly vocabulary: EmotionVocabulary,
    private readonly clock: IClock,
  ) {}

  async execute(input: GetVocabularyGrowthInput = {}): Promise<VocabularyGrowth> {
    const to = input.to ?? startOfDay(addDays(this.clock.now(), 1));
    const from = input.from ?? startOfMonth(addDays(to, -1));
    const entries = await this.repository.findAll();

    const inPeriod = entries.filter((entry) => within(entry, from, to));
    const words = wordsIn(inPeriod);
    const before = wordsIn(entries.filter((entry) => entry.createdAt < from));
    const months = monthsBetween(from, to);

    return {
      from,
      to,
      wide: months.length > 1,
      months: months.map((monthStart) => ({
        monthStart,
        distinctCount: wordsIn(
          inPeriod.filter((entry) => within(entry, monthStart, addMonths(monthStart, 1))),
        ).size,
      })),
      firstTimeIds: [...words].filter((id) => !before.has(id)),
      refinements: this.refinementsWithin(entries, months),
      widening: this.wideningWithin(inPeriod, months[0], to),
      distinctCount: words.size,
      preciseCount: [...words].filter((id) => this.depthOf(id) > ROOT_DEPTH).length,
      hasAnything: words.size > 0,
    };
  }

  /**
   * Month by month, each against everything written before it.
   *
   * The first version compared the whole period against what came before it,
   * and went blank on exactly the periods people choose: over three months,
   * someone who said "tired" in June and "exhausted" in August had both words
   * inside the period, so the trade was invisible. Walking the months puts the
   * boundary where the change actually happened.
   *
   * "Before" means before, not before the period — a broad word traded for a
   * finer one is the same event whether the broad one was last used inside the
   * period or a year earlier.
   */
  private refinementsWithin(
    entries: readonly MoodEntry[],
    months: readonly Date[],
  ): readonly RefinementPair[] {
    const pairs: RefinementPair[] = [];

    for (const monthStart of months) {
      const now = wordsIn(
        entries.filter((entry) => within(entry, monthStart, addMonths(monthStart, 1))),
      );
      const before = wordsIn(entries.filter((entry) => entry.createdAt < monthStart));

      for (const id of [...now].sort()) {
        const parentId = this.vocabulary.find(id)?.parentId;

        /*
         * Still using the broad word is a month with two feelings in it rather
         * than a trade, and the first time a word appears is the month that
         * owns it — later months are not news.
         */
        if (
          parentId !== undefined &&
          parentId !== null &&
          before.has(parentId) &&
          !now.has(parentId) &&
          !pairs.some((pair) => pair.toId === id)
        ) {
          pairs.push({ fromId: parentId, toId: id });
        }
      }
    }

    return pairs.slice(0, MOST_PAIRS);
  }

  /**
   * Feeds the one sentence on the screen that speaks about the past: at the
   * start of this it was simply X, and now it is these. Both ends have to be
   * real, so X is a root the person used in the first month of the period and
   * "these" are its descendants they used afterwards.
   *
   * Two descendants at least. With one, the sentence would claim a distinction
   * where the person only went deeper, and "different things" would be words
   * put in their mouth.
   */
  private wideningWithin(
    inPeriod: readonly MoodEntry[],
    firstMonth: Date | undefined,
    to: Date,
  ): Widening | null {
    if (firstMonth === undefined) {
      return null;
    }

    const early = wordsIn(
      inPeriod.filter((entry) => within(entry, firstMonth, addMonths(firstMonth, 1))),
    );
    const later = wordsIn(inPeriod.filter((entry) => within(entry, addMonths(firstMonth, 1), to)));

    const candidates = [...early]
      .filter((id) => this.depthOf(id) === ROOT_DEPTH)
      .map((rootId) => ({
        rootId,
        intoIds: [...later].filter((id) => id !== rootId && this.rootOf(id) === rootId).sort(),
      }))
      .filter((candidate) => candidate.intoIds.length >= 2)
      /*
       * The widest one, and the word itself breaks a tie so the same period
       * always tells the same story twice.
       */
      .sort((a, b) => b.intoIds.length - a.intoIds.length || a.rootId.localeCompare(b.rootId));

    return candidates[0] ?? null;
  }

  private rootOf(id: string): string {
    let current = this.vocabulary.find(id);

    while (current !== undefined && current.parentId !== null) {
      current = this.vocabulary.find(current.parentId);
    }

    return current?.id ?? id;
  }

  private depthOf(id: string): number {
    return this.vocabulary.find(id)?.depth ?? ROOT_DEPTH;
  }
}

function wordsIn(entries: readonly MoodEntry[]): ReadonlySet<string> {
  return new Set(entries.flatMap((entry) => [...entry.selfEmotionIds]));
}

function within(entry: MoodEntry, from: Date, to: Date): boolean {
  return entry.createdAt >= from && entry.createdAt < to;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const shifted = new Date(date.getTime());

  shifted.setDate(shifted.getDate() + days);

  return shifted;
}

/** Every month the period touches, oldest first, a partial one included. */
function monthsBetween(from: Date, to: Date): readonly Date[] {
  const months: Date[] = [];

  for (let month = startOfMonth(from); month < to; month = addMonths(month, 1)) {
    months.push(month);
  }

  return months;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}
