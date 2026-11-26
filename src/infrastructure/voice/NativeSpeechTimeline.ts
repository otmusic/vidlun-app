import type { ISpeechTimeline, SpeechSpan } from '../../domain/ports/ISpeechTimeline';

/** The voice module's reader, injected so the adapter is testable without it. */
export type ReadSpeechSpans = (uri: string) => Promise<unknown> | null;

/**
 * The speech in a kept recording, read by the voice module on the phone.
 * What comes back over the bridge is checked rather than trusted: anything
 * that is not a list of [from, to] pairs reads as nothing found.
 */
/** How many recordings' spans are remembered; a session opens a handful of entries. */
const REMEMBERED = 24;

export class NativeSpeechTimeline implements ISpeechTimeline {
  /*
   * A recording never changes, so neither do its spans. Each opening of an
   * entry decoded the whole file again — about 58 MB passing through for a
   * five-minute take — to find the same answer (battery review, 2026-11-26).
   */
  private readonly known = new Map<string, readonly SpeechSpan[]>();

  constructor(private readonly read: ReadSpeechSpans) {}

  async spans(recordingUri: string): Promise<readonly SpeechSpan[] | null> {
    const known = this.known.get(recordingUri);

    if (known !== undefined) {
      return known;
    }

    const spans = await this.readSpans(recordingUri);

    if (spans !== null) {
      this.known.set(recordingUri, spans);

      if (this.known.size > REMEMBERED) {
        const oldest = this.known.keys().next();

        if (oldest.done !== true) {
          this.known.delete(oldest.value);
        }
      }
    }

    return spans;
  }

  private async readSpans(recordingUri: string): Promise<readonly SpeechSpan[] | null> {
    const pending = this.read(recordingUri);

    if (pending === null) {
      return null;
    }

    const raw = await pending;

    if (!Array.isArray(raw)) {
      return null;
    }

    const spans: SpeechSpan[] = [];

    for (const pair of raw as unknown[]) {
      if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number' && pair[1] > pair[0]) {
        spans.push({ fromMs: pair[0], toMs: pair[1] });
      }
    }

    return spans;
  }
}
