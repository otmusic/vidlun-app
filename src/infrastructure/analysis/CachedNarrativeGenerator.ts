import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';
import { NARRATIVE_PROMPT_VERSION } from './ClaudeNarrativeGenerator';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
export const NARRATIVE_KEY_PREFIX = 'vidlun.narrative.';

interface CachedNarrative {
  /** What the month held when this was written. */
  readonly fingerprint: string;
  readonly narrative: string;
}

/**
 * A month's narrative is written once and read many times.
 *
 * Before this, opening it made a Sonnet call every time; the same month read
 * twice in one evening cost twice and said the same thing.
 *
 * One key per month, overwritten rather than added to: a month that gains an
 * entry gets a new narrative and the old one goes with it, so the store holds
 * one row per month the person has read and never grows sideways. Weekly rows
 * written before 2026-10-01 stay under the same prefix and are not read again.
 */
export class CachedNarrativeGenerator implements INarrativeGenerator {
  constructor(
    private readonly inner: INarrativeGenerator,
    private readonly store: IKeyValueStore,
  ) {}

  async generate(entries: readonly MoodEntry[]): Promise<string> {
    const key = monthKeyFor(entries);

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
    // month, not for a cache to succeed.
    await this.store
      .setItem(key, JSON.stringify({ fingerprint, narrative } satisfies CachedNarrative))
      .catch(() => undefined);

    return narrative;
  }
}

/** One row per month. Null for an empty list, which has no month to say anything about. */
function monthKeyFor(entries: readonly MoodEntry[]): string | null {
  const first = entries[0];

  if (first === undefined) {
    return null;
  }

  return `${NARRATIVE_KEY_PREFIX}month.${first.createdAt.getFullYear()}-${first.createdAt.getMonth() + 1}`;
}

/**
 * Everything the narrative was written from. An entry added, deleted or
 * corrected changes this, and a stale sentence about a month that has since
 * changed would be worse than paying for a fresh one.
 */
function fingerprintOf(entries: readonly MoodEntry[]): string {
  return `v${NARRATIVE_PROMPT_VERSION}\n` + entries
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
