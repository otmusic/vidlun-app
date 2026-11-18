import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { IVoiceAnalyzer } from '../../domain/ports/IVoiceAnalyzer';
import type { IVoiceReadings } from '../../domain/ports/IVoiceReadings';
import { compareVoice, type VoiceCue } from '../../domain/value-objects/VoiceCue';
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
    let reading = await this.readings.find(entryId);

    if (reading === null || reading.stale) {
      const uri = await this.recordings.find(entryId);
      const measured = uri === null ? null : await this.analyzer.analyze(uri);

      if (measured === null) {
        return null;
      }

      await this.readings.save(entryId, measured);
      reading = measured;
    }

    return compareVoice(reading, await this.usual(entryId));
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
