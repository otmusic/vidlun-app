import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';
import type { INarrativeMemory } from '../../domain/ports/INarrativeMemory';
import type { VoiceCue } from '../../domain/value-objects/VoiceCue';
import { NARRATIVE_PROMPT_VERSION } from './ClaudeNarrativeGenerator';
import type { IKeyValueStore } from '../persistence/IKeyValueStore';

// Renaming a key strands the data behind it; see ENTRY_KEY_PREFIX.
export const NARRATIVE_KEY_PREFIX = 'vidlun.narrative.';

interface CachedNarrative {
  /**
   * What the month held when this was written, as a hash. It used to be the
   * month itself — every transcript in full — so a deleted entry's words
   * outlived it here (security review, 2026-11-26); rows written that way
   * are hashed the first time they match.
   */
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
 * written before 2026-10-01 are swept the first time a month is read.
 */
export class CachedNarrativeGenerator implements INarrativeGenerator, INarrativeMemory {
  private swept = false;

  constructor(
    private readonly inner: INarrativeGenerator,
    private readonly store: IKeyValueStore,
  ) {}

  async generate(entries: readonly MoodEntry[], voices?: ReadonlyMap<string, VoiceCue>): Promise<string> {
    this.sweepWeeks();

    const first = entries[0];

    if (first === undefined) {
      return this.inner.generate(entries, voices);
    }

    const key = monthKeyOf(first.createdAt);
    const written = fingerprintOf(entries);
    const fingerprint = hashOf(written);
    const cached = read(await this.store.getItem(key));

    if (cached !== null && cached.fingerprint === fingerprint) {
      return cached.narrative;
    }

    if (cached !== null && cached.fingerprint === written) {
      // A row from before the hash: kept, and its transcripts dropped.
      await this.keep(key, fingerprint, cached.narrative);

      return cached.narrative;
    }

    const narrative = await this.inner.generate(entries, voices);

    await this.keep(key, fingerprint, narrative);

    return narrative;
  }

  async forgetMonthOf(day: Date): Promise<void> {
    await this.store.removeItem(monthKeyOf(day));
  }

  /** Never let storing it cost the sentence itself: the caller asked for a month, not for a cache to succeed. */
  private async keep(key: string, fingerprint: string, narrative: string): Promise<void> {
    await this.store
      .setItem(key, JSON.stringify({ fingerprint, narrative } satisfies CachedNarrative))
      .catch(() => undefined);
  }

  /** The weekly rows, unread since the week folded into the month; once per launch, never in the way. */
  private sweepWeeks(): void {
    if (this.swept) {
      return;
    }

    this.swept = true;
    void this.store
      .getAllKeys()
      .then(async (keys) => {
        for (const key of keys) {
          if (key.startsWith(NARRATIVE_KEY_PREFIX) && !key.startsWith(`${NARRATIVE_KEY_PREFIX}month.`)) {
            await this.store.removeItem(key);
          }
        }
      })
      .catch(() => undefined);
  }
}

/** One row per month. */
function monthKeyOf(day: Date): string {
  return `${NARRATIVE_KEY_PREFIX}month.${day.getFullYear()}-${day.getMonth() + 1}`;
}

/**
 * cyrb53: 53 bits, so a changed month all but never hashes the same as the
 * month before it, and nothing of what was said can be read back out of it.
 */
function hashOf(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);

    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return `h${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

/**
 * Everything the narrative was written from. An entry added, deleted or
 * corrected changes this, and a stale sentence about a month that has since
 * changed would be worse than paying for a fresh one.
 *
 * Except the voice. It is heard against the person's usual voice, which
 * moves a little with every new take, so a fingerprint carrying it would
 * rewrite — and pay for — a past month each time it is opened after a new
 * entry. The month is written with the voice as it was heard then.
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
