import { DeleteEntry } from '@/application/use-cases/DeleteEntry';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { AsyncStorageVoiceReadings } from '@/infrastructure/persistence/AsyncStorageVoiceReadings';
import { VoiceReading } from '@/domain/value-objects/VoiceReading';
import { InMemoryKeyValueStore } from '../infrastructure/fakes';
import { InMemoryRecordingStore, RecordingRevisionLog } from './fakes';

const CREATED_AT = new Date('2026-08-25T18:00:00.000Z');

function entry(id: string): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: CREATED_AT,
    source: 'voice',
    rawTranscript: 'raw words',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud'],
    confidence: Confidence.of(0.9),
  });
}

/** Remembers which months it was asked to forget. */
class ForgettingNarratives {
  readonly forgotten: Date[] = [];

  forgetMonthOf(day: Date): Promise<void> {
    this.forgotten.push(day);

    return Promise.resolve();
  }
}

function setup() {
  const repository = new InMemoryMoodEntryRepository();
  const revisionLog = new RecordingRevisionLog();
  const recordings = new InMemoryRecordingStore();
  const voiceReadings = new AsyncStorageVoiceReadings(new InMemoryKeyValueStore());
  const narratives = new ForgettingNarratives();

  return {
    repository,
    revisionLog,
    recordings,
    voiceReadings,
    narratives,
    subject: new DeleteEntry(repository, revisionLog, recordings, voiceReadings, narratives),
  };
}

describe('DeleteEntry', () => {
  it("forgets the narrative of the entry's month, which may retell what it said", async () => {
    const { repository, narratives, subject } = setup();

    await repository.save(entry('entry-1'));
    await subject.execute('entry-1');

    expect(narratives.forgotten).toEqual([CREATED_AT]);
  });

  it('forgets what was measured in the voice along with the voice', async () => {
    const { repository, voiceReadings, subject } = setup();
    const reading = VoiceReading.from({ version: 1, speechMs: 4000, loudnessDb: -20 });

    await repository.save(entry('entry-1'));
    await repository.save(entry('entry-2'));
    if (reading !== null) {
      await voiceReadings.save('entry-1', reading);
      await voiceReadings.save('entry-2', reading);
    }

    await subject.execute('entry-1');

    expect(await voiceReadings.find('entry-1')).toBeNull();
    expect(await voiceReadings.find('entry-2')).not.toBeNull();
  });

  it('removes the entry', async () => {
    const { repository, subject } = setup();
    await repository.save(entry('entry-1'));

    await subject.execute('entry-1');

    expect(await repository.findById('entry-1')).toBeNull();
  });

  it('leaves the other entries alone', async () => {
    const { repository, subject } = setup();
    await repository.save(entry('entry-1'));
    await repository.save(entry('entry-2'));

    await subject.execute('entry-1');

    expect(await repository.findById('entry-2')).not.toBeNull();
  });

  it('forgets what Vidlun proposed for it, which was made out of their words', async () => {
    const { repository, revisionLog, subject } = setup();
    await repository.save(entry('entry-1'));
    await revisionLog.record({
      entryId: 'entry-1',
      revisedAt: CREATED_AT,
      proposedMood: 4,
      finalMood: 5,
      proposedEmotionIds: ['happy.proud'],
      finalEmotionIds: ['happy'],
    });

    await subject.execute('entry-1');

    expect(revisionLog.records).toEqual([]);
    expect(revisionLog.forgotten).toEqual(['entry-1']);
  });

  it('keeps the revisions belonging to entries that stayed', async () => {
    const { revisionLog, subject } = setup();
    const revision = {
      revisedAt: CREATED_AT,
      proposedMood: 4,
      finalMood: 5,
      proposedEmotionIds: ['happy.proud'],
      finalEmotionIds: ['happy'],
    };
    await revisionLog.record({ ...revision, entryId: 'entry-1' });
    await revisionLog.record({ ...revision, entryId: 'entry-2' });

    await subject.execute('entry-1');

    expect(revisionLog.records.map((r) => r.entryId)).toEqual(['entry-2']);
  });

  it('takes the recording with it', async () => {
    const { repository, recordings, subject } = setup();
    await repository.save(entry('entry-1'));
    await recordings.keep('entry-1', 'file:///take.wav');

    const deleted = await subject.execute('entry-1');

    expect(await recordings.find('entry-1')).toBeNull();

    await deleted.settle();

    expect(recordings.held.size).toBe(0);
    expect(recordings.released).toEqual(['file:///cache/held-voices/entry-1']);
  });

  it('leaves other recordings where they are', async () => {
    const { recordings, subject } = setup();
    await recordings.keep('entry-1', 'file:///one.wav');
    await recordings.keep('entry-2', 'file:///two.wav');

    await subject.execute('entry-1');

    expect(await recordings.find('entry-2')).toBe('file:///two.wav');
  });

  it('says nothing about an entry that was never there', async () => {
    const { subject } = setup();
    const deleted = await subject.execute('never-existed');

    await expect(deleted.restore()).resolves.toBeUndefined();
  });
});

describe('DeleteEntry, undone', () => {
  const revision = {
    entryId: 'entry-1',
    revisedAt: CREATED_AT,
    proposedMood: 4,
    finalMood: 5,
    proposedEmotionIds: ['happy.proud'],
    finalEmotionIds: ['happy'],
  };
  const disagreement = {
    entryId: 'entry-1',
    at: CREATED_AT,
    proposedEmotionIds: ['happy.proud'],
    selfEmotionIds: [],
  };

  it('puts back the entry, its voice, what was measured in it and what was revised', async () => {
    const { repository, revisionLog, recordings, voiceReadings, subject } = setup();
    const reading = VoiceReading.from({ version: 1, speechMs: 4000, loudnessDb: -20 });

    await repository.save(entry('entry-1'));
    await recordings.keep('entry-1', 'file:///one.m4a');
    await revisionLog.record(revision);
    await revisionLog.disagree(disagreement);
    if (reading !== null) {
      await voiceReadings.save('entry-1', reading);
    }

    const deleted = await subject.execute('entry-1');

    expect(await repository.findById('entry-1')).toBeNull();
    expect(revisionLog.records).toEqual([]);

    await deleted.restore();

    expect((await repository.findById('entry-1'))?.cleanTranscript).toBe(entry('entry-1').cleanTranscript);
    expect(await recordings.find('entry-1')).toBe('file:///cache/held-voices/entry-1');
    expect(revisionLog.records).toEqual([revision]);
    expect(revisionLog.disagreements).toEqual([disagreement]);
    expect(await voiceReadings.find('entry-1')).not.toBeNull();
    expect(recordings.released).toEqual([]);
  });

  it('brings back an entry that never had a voice, without one', async () => {
    const { repository, recordings, subject } = setup();

    await repository.save(entry('entry-1'));

    const deleted = await subject.execute('entry-1');

    await deleted.restore();

    expect(await repository.findById('entry-1')).not.toBeNull();
    expect(await recordings.find('entry-1')).toBeNull();
  });

  it('cannot be undone once settled, nor settled once undone', async () => {
    const { repository, recordings, subject } = setup();

    await repository.save(entry('entry-1'));
    await recordings.keep('entry-1', 'file:///one.m4a');

    const settled = await subject.execute('entry-1');

    await settled.settle();
    await settled.restore();

    expect(await repository.findById('entry-1')).toBeNull();

    await repository.save(entry('entry-2'));
    await recordings.keep('entry-2', 'file:///two.m4a');

    const undone = await subject.execute('entry-2');

    await undone.restore();
    await undone.settle();

    expect(await recordings.find('entry-2')).toBe('file:///cache/held-voices/entry-2');
    expect(recordings.released).toEqual(['file:///cache/held-voices/entry-1']);
  });
});
