import { ForgetOldRecordings } from '@/application/use-cases/ForgetOldRecordings';
import { FixedClock, InMemoryRecordingStore } from './fakes';

const NOW = new Date('2026-08-25T12:00:00.000Z');

describe('ForgetOldRecordings', () => {
  it('sweeps everything older than a year', async () => {
    const recordings = new InMemoryRecordingStore();

    await new ForgetOldRecordings(recordings, new FixedClock(NOW)).execute();

    const cutoff = recordings.sweptBefore;

    expect(cutoff).not.toBeNull();
    expect(cutoff?.getUTCFullYear()).toBe(2025);
    expect(cutoff?.getUTCMonth()).toBe(7);
    expect(cutoff?.getUTCDate()).toBe(25);
  });

  it('asks for a cutoff in the past, never the future', async () => {
    const recordings = new InMemoryRecordingStore();

    await new ForgetOldRecordings(recordings, new FixedClock(NOW)).execute();

    expect(recordings.sweptBefore?.getTime()).toBeLessThan(NOW.getTime());
  });
});
