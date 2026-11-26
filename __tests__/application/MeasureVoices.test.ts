import { MeasureVoices } from '@/application/use-cases/MeasureVoices';
import type { IVoiceAnalyzer } from '@/domain/ports/IVoiceAnalyzer';
import { VoiceReading } from '@/domain/value-objects/VoiceReading';
import { AsyncStorageVoiceReadings } from '@/infrastructure/persistence/AsyncStorageVoiceReadings';

import { InMemoryKeyValueStore } from '../infrastructure/fakes';
import { InMemoryRecordingStore } from './fakes';

/** Measures every file as a voice of the given loudness, and remembers what it was asked. */
class FakeAnalyzer implements IVoiceAnalyzer {
  readonly asked: string[] = [];
  unreadable = new Set<string>();
  absent = false;

  analyze(uri: string): Promise<VoiceReading | null> {
    this.asked.push(uri);

    if (this.absent) {
      return Promise.resolve(null);
    }

    if (this.unreadable.has(uri)) {
      return Promise.reject(new Error('cannot read'));
    }

    return Promise.resolve(VoiceReading.from({ version: VoiceReading.VERSION, speechMs: 4000, loudnessDb: -20 }));
  }
}

function setup(batch?: number) {
  const recordings = new InMemoryRecordingStore();
  const readings = new AsyncStorageVoiceReadings(new InMemoryKeyValueStore());
  const analyzer = new FakeAnalyzer();

  return { recordings, readings, analyzer, subject: new MeasureVoices(recordings, readings, analyzer, batch) };
}

describe('measuring the voice in kept recordings', () => {
  it('measures every recording without a reading, the ones kept before this existed too', async () => {
    const { recordings, readings, subject } = setup();

    await recordings.keep('old', 'file:///old.wav');
    await recordings.keep('new', 'file:///new.wav');

    expect(await subject.execute()).toBe(2);
    expect([...(await readings.all()).keys()].sort()).toEqual(['new', 'old']);
  });

  it('does not measure a recording twice', async () => {
    const { recordings, analyzer, subject } = setup();

    await recordings.keep('e1', 'file:///e1.wav');
    await subject.execute();
    await subject.execute();

    expect(analyzer.asked).toEqual(['file:///e1.wav']);
  });

  it('measures again what an older analysis measured', async () => {
    const { recordings, readings, analyzer, subject } = setup();
    const old = VoiceReading.from({ version: 0, speechMs: 4000 });

    await recordings.keep('e1', 'file:///e1.wav');
    if (old !== null) {
      await readings.save('e1', old);
    }
    await subject.execute();

    expect(analyzer.asked).toEqual(['file:///e1.wav']);
    expect((await readings.find('e1'))?.stale).toBe(false);
  });

  it('skips a file it cannot read and goes on with the rest', async () => {
    const { recordings, readings, analyzer, subject } = setup();

    await recordings.keep('bad', 'file:///bad.wav');
    await recordings.keep('good', 'file:///good.wav');
    analyzer.unreadable.add('file:///bad.wav');

    expect(await subject.execute()).toBe(1);
    expect(await readings.find('good')).not.toBeNull();
    expect(await readings.find('bad')).toBeNull();
  });

  it('stops asking where nothing can measure a voice', async () => {
    const { recordings, readings, analyzer, subject } = setup();

    await recordings.keep('e1', 'file:///e1.wav');
    await recordings.keep('e2', 'file:///e2.wav');
    analyzer.absent = true;

    expect(await subject.execute()).toBe(0);
    expect(analyzer.asked).toHaveLength(1);
    expect((await readings.all()).size).toBe(0);
  });

  it('measures a long journal a batch at a time', async () => {
    const { recordings, subject } = setup(2);

    for (const id of ['a', 'b', 'c']) {
      await recordings.keep(id, `file:///${id}.wav`);
    }

    expect(await subject.execute()).toBe(2);
    expect(await subject.execute()).toBe(1);
    expect(await subject.execute()).toBe(0);
  });

  it('joins a pass already running rather than starting a second', async () => {
    const { recordings, analyzer, subject } = setup();

    await recordings.keep('e1', 'file:///e1.wav');
    const [first, second] = await Promise.all([subject.execute(), subject.execute()]);

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(analyzer.asked).toHaveLength(1);
  });
});

describe('a recording that cannot be read', () => {
  it('is not tried again on every pass, and does not hold back the ones after it', async () => {
    const { recordings, readings, analyzer, subject } = setup(1);

    analyzer.unreadable.add('file:///broken.wav');
    await recordings.keep('broken', 'file:///broken.wav');
    await recordings.keep('fine', 'file:///fine.wav');

    await subject.execute();
    await subject.execute();
    await subject.execute();

    expect(analyzer.asked.filter((uri) => uri === 'file:///broken.wav')).toHaveLength(1);
    expect((await readings.all()).has('fine')).toBe(true);
  });
});
