import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
export const NARRATIVE_KEY_PREFIX = 'vidlun.narrative.';

interface CachedNarrative {
  /** What the week held when this was written. */
  readonly fingerprint: string;
  readonly narrative: string;
}

/**
 * A week's narrative is written once and read many times.
 *
 * Before this, opening the insights screen made a Sonnet call every time — and
 * since the drawing gives the first paragraph away, that was true for people
 * who had paid for nothing. The same week read twice in one evening cost twice
 * and said the same thing.
 *
 * One key per week, overwritten rather than added to: a week that gains an
 * entry gets a new narrative and the old one goes with it, so the store holds
 * one row per week the person has looked at and never grows sideways.
 */
export class CachedNarrativeGenerator implements INarrativeGenerator {
  constructor(
    private readonly inner: INarrativeGenerator,
    private readonly store: IKeyValueStore,
  ) {}

  async generate(entries: readonly MoodEntry[]): Promise<string> {
    const key = keyFor(entries);

    if (key === null) {
      return this.inner.generate(entries);
    }

    const fingerprint = fingerprintOf(entries);
    const cached = read(await this.store.getItem(key));

    if (cached !== null && cached.fingerprint === fingerprint) {
      return cached.narrative;
    }

    const narrative = await this.inner.generate(entries);

    // Never let storing it cost the sentence itself: the caller asked for a
    // week, not for a cache to succeed.
    await this.store
      .setItem(key, JSON.stringify({ fingerprint, narrative } satisfies CachedNarrative))
      .catch(() => undefined);

    return narrative;
  }
}

/**
 * The week the entries fall in. Null for an empty list, which has no week and
 * nothing to say about one.
 */
function keyFor(entries: readonly MoodEntry[]): string | null {
  const first = entries[0];

  if (first === undefined) {
    return null;
  }

  const monday = startOfWeek(first.createdAt);

  return `${NARRATIVE_KEY_PREFIX}${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
}

/**
 * Everything the narrative was written from. An entry added, deleted or
 * corrected changes this, and a stale sentence about a week that has since
 * changed would be worse than paying for a fresh one.
 */
function fingerprintOf(entries: readonly MoodEntry[]): string {
  return entries
    .map((entry) =>
      [
        entry.id,
        entry.mood?.value ?? '-',
        entry.emotionIds.join('+'),
        entry.contextTags.join('+'),
        entry.cleanTranscript,
      ].join('|'),
    )
    .join('\n');
}

function read(raw: string | null): CachedNarrative | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as CachedNarrative).fingerprint === 'string' &&
      typeof (parsed as CachedNarrative).narrative === 'string'
    ) {
      return parsed as CachedNarrative;
    }
  } catch {
    // An unreadable row is a row to overwrite, not an error to raise.
  }

  return null;
}

/** Monday, matching the week `GetWeekSummary` builds. */
function startOfWeek(date: Date): Date {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (midnight.getDay() + 6) % 7;

  midnight.setDate(midnight.getDate() - daysSinceMonday);

  return midnight;
}
