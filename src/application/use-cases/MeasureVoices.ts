import type { IRecordingStore } from '../../domain/ports/IRecordingStore';
import type { IVoiceAnalyzer } from '../../domain/ports/IVoiceAnalyzer';
import type { IVoiceReadings } from '../../domain/ports/IVoiceReadings';

/** How many recordings one pass measures, so a long journal is measured over a few openings. */
const BATCH = 40;

/**
 * Measures the voice in every kept recording that has no reading yet (owner's
 * word, 2026-11-12: how heavy or light an entry sounded, for the statistics
 * later). Runs after an entry is saved and whenever the app comes to the
 * front, and the recordings kept before it existed are measured the same
 * way, so the history is there from the start.
 *
 * Only kept recordings: someone who turned keeping off has no file to
 * measure, and a reading is not taken from a take on its way to the bin.
 */
export class MeasureVoices {
  private running: Promise<number> | null = null;

  constructor(
    private readonly recordings: IRecordingStore,
    private readonly readings: IVoiceReadings,
    private readonly analyzer: IVoiceAnalyzer,
    private readonly batch = BATCH,
  ) {}

  /** Resolves with how many recordings were measured. A second call joins the first. */
  execute(): Promise<number> {
    this.running ??= this.measure().finally(() => {
      this.running = null;
    });

    return this.running;
  }

  private async measure(): Promise<number> {
    const kept = await this.recordings.withAudio();
    const measured = await this.readings.all();
    const waiting = [...kept]
      .filter((id) => {
        const reading = measured.get(id);

        return reading === undefined || reading.stale;
      })
      .slice(0, this.batch);
    let done = 0;

    for (const id of waiting) {
      const uri = await this.recordings.find(id);

      // Swept or deleted since the list was made.
      if (uri === null) {
        continue;
      }

      let reading;

      try {
        reading = await this.analyzer.analyze(uri);
      } catch {
        // One unreadable file costs its own reading, not the others'.
        continue;
      }

      if (reading === null) {
        return done;
      }

      await this.readings.save(id, reading);
      done += 1;
    }

    return done;
  }
}
