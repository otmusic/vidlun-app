import type { IClock } from '../../domain/ports/IClock';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

/**
 * Thirteen months, not twelve: the yearly echo plays a recording back on its
 * anniversary, and a sweep at exactly a year would take the voice the day it
 * was needed. Owner's decision, 2026-09-07. After that the audio goes and
 * the entry stays whole.
 */
const KEEP_MONTHS = 13;

/**
 * Runs when the app opens. There is no background job and there does not need
 * to be one: a recording a few days past its term does no harm, and a sweep
 * the user never sees is better than a scheduler to maintain.
 */
export class ForgetOldRecordings {
  constructor(
    private readonly recordings: IRecordingStore,
    private readonly clock: IClock,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date(this.clock.now().getTime());

    // By the calendar rather than a day count, so "thirteen months" is what
    // the privacy policy says and not 395 days that drift past it.
    cutoff.setUTCMonth(cutoff.getUTCMonth() - KEEP_MONTHS);

    await this.recordings.discardBefore(cutoff);
  }
}
