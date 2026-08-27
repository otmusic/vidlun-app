import { DeleteEntry } from '@/application/use-cases/DeleteEntry';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
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

function setup() {
  const repository = new InMemoryMoodEntryRepository();
  const revisionLog = new RecordingRevisionLog();
  const recordings = new InMemoryRecordingStore();

  return {
    repository,
    revisionLog,
    recordings,
    subject: new DeleteEntry(repository, revisionLog, recordings),
  };
}

describe('DeleteEntry', () => {
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

    await subject.execute('entry-1');

    expect(await recordings.find('entry-1')).toBeNull();
    expect(recordings.discarded).toEqual(['entry-1']);
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

    await expect(subject.execute('never-existed')).resolves.toBeUndefined();
  });
});
