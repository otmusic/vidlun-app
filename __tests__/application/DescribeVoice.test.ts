import { DescribeVoice } from '@/application/use-cases/DescribeVoice';
import type { IVoiceAnalyzer } from '@/domain/ports/IVoiceAnalyzer';
import { VoiceReading } from '@/domain/value-objects/VoiceReading';
import { AsyncStorageVoiceReadings } from '@/infrastructure/persistence/AsyncStorageVoiceReadings';

import { InMemoryKeyValueStore } from '../infrastructure/fakes';
import { InMemoryRecordingStore } from './fakes';

function reading(loudnessDb: number, version = VoiceReading.VERSION): VoiceReading {
  const made = VoiceReading.from({ version, speechMs: 6000, loudnessDb });

  if (made === null) {
    throw new Error('not a reading');
  }

  return made;
}

/** Every file it is given sounds this loud; absent, nothing on the phone measures. */
class FakeAnalyzer implements IVoiceAnalyzer {
  readonly asked: string[] = [];
  absent = false;

  constructor(private readonly loudnessDb: number) {}

  analyze(uri: string): Promise<VoiceReading | null> {
    this.asked.push(uri);

    return Promise.resolve(this.absent ? null : reading(this.loudnessDb));
  }
}

async function setup(takeLoudness: number, usual: readonly number[]) {
  const readings = new AsyncStorageVoiceReadings(new InMemoryKeyValueStore());
  const recordings = new InMemoryRecordingStore();
  const analyzer = new FakeAnalyzer(takeLoudness);

  for (const [at, loudness] of usual.entries()) {
    await readings.save(`old-${at}`, reading(loudness));
  }

  return { readings, recordings, analyzer, subject: new DescribeVoice(analyzer, readings, recordings) };
}

const ORDINARY = [-20, -21, -19, -20, -22, -18, -20];

describe('describing a voice against its usual self', () => {
  it('measures a fresh take and sets it against the readings kept so far', async () => {
    const { subject } = await setup(-35, ORDINARY);

    expect(await subject.ofTake('file:///take.wav')).toEqual({ marks: ['quieter'] });
  });

  it('says nothing where nothing on the phone measures', async () => {
    const { analyzer, subject } = await setup(-35, ORDINARY);

    analyzer.absent = true;

    expect(await subject.ofTake('file:///take.wav')).toBeNull();
  });

  it('reads a saved entry from its own reading, leaving it out of what is usual', async () => {
    const { readings, analyzer, subject } = await setup(-20, ORDINARY);

    await readings.save('entry', reading(-35));

    expect(await subject.ofEntry('entry')).toEqual({ marks: ['quieter'] });
    expect(analyzer.asked).toEqual([]);
  });

  it('measures a saved entry that has no reading yet, and keeps the reading', async () => {
    const { readings, recordings, subject } = await setup(-35, ORDINARY);

    await recordings.keep('entry', 'file:///entry.wav');

    expect(await subject.ofEntry('entry')).toEqual({ marks: ['quieter'] });
    expect((await readings.find('entry'))?.loudnessDb).toBe(-35);
  });

  it('says nothing about an entry without a recording', async () => {
    const { subject } = await setup(-35, ORDINARY);

    expect(await subject.ofEntry('typed')).toBeNull();
  });

  it('does not count readings from an older analysis as usual', async () => {
    const { subject } = await setup(-35, [-20, -20, -20, -20]);
    const stale = await setup(-35, []);

    for (const at of [0, 1, 2, 3]) {
      await stale.readings.save(`older-${at}`, reading(-20, 0));
    }

    expect(await subject.ofTake('file:///take.wav')).toBeNull();
    expect(await stale.subject.ofTake('file:///take.wav')).toBeNull();
  });
});
