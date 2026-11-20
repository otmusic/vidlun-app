import type { ISpeechTimeline, SpeechSpan } from '../../domain/ports/ISpeechTimeline';

/** The voice module's reader, injected so the adapter is testable without it. */
export type ReadSpeechSpans = (uri: string) => Promise<unknown> | null;

/**
 * The speech in a kept recording, read by the voice module on the phone.
 * What comes back over the bridge is checked rather than trusted: anything
 * that is not a list of [from, to] pairs reads as nothing found.
 */
export class NativeSpeechTimeline implements ISpeechTimeline {
  constructor(private readonly read: ReadSpeechSpans) {}

  async spans(recordingUri: string): Promise<readonly SpeechSpan[] | null> {
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
