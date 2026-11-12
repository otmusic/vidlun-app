import type { IEchoWriter } from '../../domain/ports/IEchoWriter';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { VoiceCue } from '../../domain/value-objects/VoiceCue';
import type { DescribeVoice } from './DescribeVoice';

/**
 * The echo, back (owner's word, 2026-11-12, after it was taken out on
 * 2026-10-30): one short sentence about a saved entry, written from what was
 * said, the mood and emotions the person kept, and how their voice sounded
 * against its usual self — most of all where the voice and the words go
 * different ways.
 *
 * Written after saving rather than on the card. The card stays as fast as it
 * was, the observation still comes only after the person has answered (§9),
 * and the echo reads their answer rather than guessing ahead of it.
 *
 * Never for a hard entry: an entry that sounded overwhelmed, or worse, gets
 * no remark about how the person sounds.
 */
export class WriteEcho {
  constructor(
    private readonly repository: IMoodEntryRepository,
    private readonly writer: IEchoWriter,
    private readonly describeVoice: DescribeVoice,
  ) {}

  /** Resolves true when an echo was written onto the entry. */
  async execute(entryId: string): Promise<boolean> {
    const entry = await this.repository.findById(entryId);

    if (entry === null || entry.observation !== null || entry.safetyFlag !== 'none') {
      return false;
    }

    let voice: VoiceCue | null = null;

    try {
      voice = await this.describeVoice.ofEntry(entryId);
    } catch {
      // A voice that could not be measured leaves the words to speak alone.
    }

    const written = await this.writer.write({
      transcript: entry.cleanTranscript,
      mood: entry.mood?.value ?? null,
      emotionIds: entry.emotionIds,
      voice,
    });
    const echo = written?.trim() ?? '';

    if (echo.length === 0) {
      return false;
    }

    // Read again: the person may have deleted or changed the entry meanwhile.
    const latest = await this.repository.findById(entryId);

    if (latest === null || latest.observation !== null) {
      return false;
    }

    await this.repository.save(latest.withObservation(echo));

    return true;
  }
}
