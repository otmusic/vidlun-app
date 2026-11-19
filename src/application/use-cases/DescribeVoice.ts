import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { IVoiceAnalyzer } from '../../domain/ports/IVoiceAnalyzer';
import type { IVoiceReadings } from '../../domain/ports/IVoiceReadings';
import {
  ENOUGH_USUAL,
  compareVoice,
  voicePortrait,
  type VoiceCue,
  type VoiceHeard,
} from '../../domain/value-objects/VoiceCue';
import type { VoiceReading } from '../../domain/value-objects/VoiceReading';

/** The most recent takes are the person's voice as it is now. */
const USUAL = 30;

/**
 * How a voice sounded against the person's usual one (owner's word,
 * 2026-11-12): for the emotions offered on the card, and for the echo.
 * Null whenever it cannot be said — nothing on this phone measures, or too
 * few takes have been heard yet to know what usual is.
 */
export class DescribeVoice {
  constructor(
    private readonly analyzer: IVoiceAnalyzer,
    private readonly readings: IVoiceReadings,
    private readonly recordings: IRecordingStore,
  ) {}

  /** A take just recorded, still in the recorder's scratch space. */
  async ofTake(uri: string): Promise<VoiceCue | null> {
    const take = await this.analyzer.analyze(uri);

    return take === null ? null : compareVoice(take, await this.usual(null));
  }

  /** A saved entry, measured now if its reading is not there yet. */
  async ofEntry(entryId: string): Promise<VoiceCue | null> {
    const reading = await this.readingOf(entryId);

    return reading === null ? null : compareVoice(reading, await this.usual(entryId));
  }

  /**
   * A saved entry for its own page (owner's word, 2026-11-19): as `ofEntry`,
   * but saying why there is nothing to compare — too few takes heard yet is
   * worth telling the person, a take with no voice in it is not.
   */
  async hearEntry(entryId: string): Promise<VoiceHeard> {
    const reading = await this.readingOf(entryId);

    if (reading === null || !reading.heard) {
      return { kind: 'silent' };
    }

    const usual = await this.usual(entryId);

    if (usual.filter((other) => other.heard).length < ENOUGH_USUAL) {
      return { kind: 'learning' };
    }

    const cue = compareVoice(reading, usual);
    const portrait = voicePortrait(reading, usual);

    return cue === null || portrait === null ? { kind: 'silent' } : { kind: 'compared', cue, portrait };
  }

  /** The entry's reading, measured now if it is missing or from an older analysis. */
  private async readingOf(entryId: string): Promise<VoiceReading | null> {
    const kept = await this.readings.find(entryId);

    if (kept !== null && !kept.stale) {
      return kept;
    }

    const uri = await this.recordings.find(entryId);
    const measured = uri === null ? null : await this.analyzer.analyze(uri);

    if (measured === null) {
      return null;
    }

    await this.readings.save(entryId, measured);

    return measured;
  }

  /**
   * Saved entries as their voices were already measured, for the monthly
   * piece (owner's word, 2026-11-18). Nothing is measured here: that is
   * `MeasureVoices`' job, and a month would otherwise wait on a pass over
   * every recording in it. An entry with no reading, or one too thin to
   * compare, is left out of the map.
   *
   * Each is set against every other reading the phone holds rather than the
   * latest thirty, so a past month is heard against the person's voice as a
   * whole and not against however they happen to sound this week.
   */
  async ofSaved(entryIds: readonly string[]): Promise<ReadonlyMap<string, VoiceCue>> {
    const all = await this.readings.all();
    const fresh = [...all].filter(([, reading]) => !reading.stale);
    const cues = new Map<string, VoiceCue>();

    for (const id of entryIds) {
      const reading = all.get(id);

      if (reading === undefined || reading.stale) {
        continue;
      }

      const cue = compareVoice(
        reading,
        fresh.filter(([other]) => other !== id).map(([, usual]) => usual),
      );

      if (cue !== null) {
        cues.set(id, cue);
      }
    }

    return cues;
  }

  private async usual(except: string | null): Promise<readonly VoiceReading[]> {
    const all = await this.readings.all();

    return [...all]
      .filter(([id, reading]) => id !== except && !reading.stale)
      .map(([, reading]) => reading)
      .slice(-USUAL);
  }
}
