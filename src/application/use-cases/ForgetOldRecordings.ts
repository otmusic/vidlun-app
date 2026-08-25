import type { IClock } from '../../domain/ports/IClock';
import type { IRecordingStore } from '../../domain/ports/IRecordingStore';

/** A year, after which the audio goes and the entry stays whole. */
const KEEP_DAYS = 365;

/**
 * Runs when the app opens. There is no background job and there does not need
 * to be one: a recording a few days past its year does no harm, and a sweep
 * the user never sees is better than a scheduler to maintain.
 */
export class ForgetOldRecordings {
  constructor(
    private readonly recordings: IRecordingStore,
    private readonly clock: IClock,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date(this.clock.now().getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000);

    await this.recordings.discardBefore(cutoff);
  }
}
