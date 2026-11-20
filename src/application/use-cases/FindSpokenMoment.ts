import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { ISpeechTimeline, SpeechSpan } from '../../domain/ports/ISpeechTimeline';
import type { SearchQuery } from '../../domain/value-objects/SearchQuery';

/**
 * How much earlier than the estimate the player starts: the estimate is a
 * second or two either way, and hearing the lead-in is better than missing
 * the word.
 */
export const LEAD_IN_MS = 2_000;

/**
 * Where in an entry's recording a searched word is said (owner's word,
 * 2026-11-20, variant B): an estimate, not a timestamp. Nothing records when
 * each word was spoken, so the word's place in the text is laid over the
 * stretches of the recording where the person was speaking — the pauses
 * take no share of it. It works for every entry with a voice, the oldest
 * included, and stores nothing.
 */
export class FindSpokenMoment {
  constructor(private readonly timeline: ISpeechTimeline) {}

  /** Milliseconds into the recording to start from; null when there is no telling. */
  async execute(entry: MoodEntry, recordingUri: string, query: SearchQuery): Promise<number | null> {
    const share = shareBefore(entry, query);

    if (share === null) {
      return null;
    }

    const spans = await this.timeline.spans(recordingUri).catch(() => null);

    if (spans === null || spans.length === 0) {
      return null;
    }

    return Math.max(0, momentAt(share, spans) - LEAD_IN_MS);
  }
}

/**
 * How far into what was said the word comes, as a share of the text. The
 * raw transcript first, since it follows the speech word for word; the
 * cleaned one when the word was only there after cleaning.
 */
export function shareBefore(entry: MoodEntry, query: SearchQuery): number | null {
  for (const text of [entry.rawTranscript, entry.cleanTranscript]) {
    const found = query.firstIn(text);

    if (found !== null && text.length > 0) {
      return found.start / text.length;
    }
  }

  return null;
}

/** The moment `share` of the way through the speech, skipping the pauses. */
export function momentAt(share: number, spans: readonly SpeechSpan[]): number {
  const total = spans.reduce((sum, span) => sum + (span.toMs - span.fromMs), 0);
  let left = Math.min(1, Math.max(0, share)) * total;

  for (const span of spans) {
    const length = span.toMs - span.fromMs;

    if (left <= length) {
      return span.fromMs + left;
    }

    left -= length;
  }

  return spans[spans.length - 1]?.toMs ?? 0;
}
