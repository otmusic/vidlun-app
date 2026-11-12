import { DescribeVoice } from '@/application/use-cases/DescribeVoice';
import { WriteEcho } from '@/application/use-cases/WriteEcho';
import { MoodEntry, type SafetyFlag } from '@/domain/entities/MoodEntry';
import type { EchoInput, IEchoWriter } from '@/domain/ports/IEchoWriter';
import type { IVoiceAnalyzer } from '@/domain/ports/IVoiceAnalyzer';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { VoiceReading } from '@/domain/value-objects/VoiceReading';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { AsyncStorageVoiceReadings } from '@/infrastructure/persistence/AsyncStorageVoiceReadings';

import { InMemoryKeyValueStore } from '../infrastructure/fakes';
import { InMemoryRecordingStore } from './fakes';

class FakeWriter implements IEchoWriter {
  readonly given: EchoInput[] = [];

  constructor(private readonly echo: string | null = 'A good day, told in a quiet voice.') {}

  write(input: EchoInput): Promise<string | null> {
    this.given.push(input);

    return Promise.resolve(this.echo);
  }
}

const silentAnalyzer: IVoiceAnalyzer = { analyze: () => Promise.resolve(null) };

function entry(safetyFlag: SafetyFlag = 'none', observation: string | null = null): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: new Date('2026-11-12T19:00:00.000Z'),
    source: 'voice',
    rawTranscript: 'Good day, finished the project.',
    cleanTranscript: 'Good day, finished the project.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud'],
    observation,
    confidence: Confidence.of(0.9),
    safetyFlag,
  });
}

async function setup(saved: MoodEntry | null, writer = new FakeWriter()) {
  const repository = new InMemoryMoodEntryRepository();
  const readings = new AsyncStorageVoiceReadings(new InMemoryKeyValueStore());
  const describeVoice = new DescribeVoice(silentAnalyzer, readings, new InMemoryRecordingStore());

  if (saved !== null) {
    await repository.save(saved);
  }

  return { repository, writer, readings, subject: new WriteEcho(repository, writer, describeVoice) };
}

describe('the echo after an entry is saved', () => {
  it('writes the echo onto the saved entry, from what the person kept', async () => {
    const { repository, writer, subject } = await setup(entry());

    expect(await subject.execute('entry-1')).toBe(true);
    expect((await repository.findById('entry-1'))?.observation).toBe(
      'A good day, told in a quiet voice.',
    );
    expect(writer.given[0]).toEqual({
      transcript: 'Good day, finished the project.',
      mood: 4,
      emotionIds: ['happy.proud'],
      voice: null,
    });
  });

  it('gives the writer how the voice sounded against the usual one', async () => {
    const { readings, writer, subject } = await setup(entry());
    const loud = (db: number) => VoiceReading.from({ version: VoiceReading.VERSION, speechMs: 6000, loudnessDb: db });

    for (const [at, db] of [-20, -21, -19, -20, -22].entries()) {
      const made = loud(db);

      if (made !== null) {
        await readings.save(`old-${at}`, made);
      }
    }
    const own = loud(-35);

    if (own !== null) {
      await readings.save('entry-1', own);
    }

    await subject.execute('entry-1');

    expect(writer.given[0]?.voice).toEqual({ marks: ['quieter'] });
  });

  it('writes nothing for a hard entry', async () => {
    for (const flag of ['distress', 'crisis'] as const) {
      const { writer, subject } = await setup(entry(flag));

      expect(await subject.execute('entry-1')).toBe(false);
      expect(writer.given).toEqual([]);
    }
  });

  it('leaves an entry that already has an echo as it is', async () => {
    const { writer, subject } = await setup(entry('none', 'An echo from before.'));

    expect(await subject.execute('entry-1')).toBe(false);
    expect(writer.given).toEqual([]);
  });

  it('takes nothing to say as a complete answer', async () => {
    const { repository, subject } = await setup(entry(), new FakeWriter(null));

    expect(await subject.execute('entry-1')).toBe(false);
    expect((await repository.findById('entry-1'))?.observation).toBeNull();
  });

  it('does not bring back an entry deleted while the echo was being written', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const readings = new AsyncStorageVoiceReadings(new InMemoryKeyValueStore());
    const writer: IEchoWriter = {
      write: async () => {
        await repository.delete('entry-1');

        return 'Too late.';
      },
    };
    const subject = new WriteEcho(
      repository,
      writer,
      new DescribeVoice(silentAnalyzer, readings, new InMemoryRecordingStore()),
    );

    await repository.save(entry());

    expect(await subject.execute('entry-1')).toBe(false);
    expect(await repository.findById('entry-1')).toBeNull();
  });

  it('does nothing for an entry that is not there', async () => {
    const { writer, subject } = await setup(null);

    expect(await subject.execute('entry-1')).toBe(false);
    expect(writer.given).toEqual([]);
  });
});
