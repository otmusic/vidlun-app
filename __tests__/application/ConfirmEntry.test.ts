import { ConfirmEntry } from '@/application/use-cases/ConfirmEntry';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { MismatchedDraftError } from '@/domain/errors/MoodEntryErrors';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock, InMemoryRecordingStore, RecordingRevisionLog } from './fakes';

const NOW = new Date('2026-07-31T20:15:00.000Z');

function draft(overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: NOW,
    source: 'voice',
    rawTranscript: 'finished three tasks happy but very tired',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud', 'bad.tired'],
    confidence: Confidence.of(0.9),
    ...overrides,
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
    useCase: new ConfirmEntry(repository, revisionLog, new FixedClock(NOW), recordings),
  };
}

describe('keeping the recording', () => {
  it('keeps the take under the entry it became', async () => {
    const { useCase, recordings } = setup();
    const saved = draft();

    await useCase.execute({ proposed: saved, confirmed: saved, recordingUri: 'file:///take.wav' });

    expect(recordings.kept.get(saved.id)).toBe('file:///take.wav');
  });

  it('keeps nothing for an entry that was typed', async () => {
    const { useCase, recordings } = setup();
    const saved = draft();

    await useCase.execute({ proposed: saved, confirmed: saved });

    expect(recordings.kept.size).toBe(0);
  });

  it('still saves the entry when the recording cannot be kept', async () => {
    const { useCase, repository, recordings } = setup();
    recordings.failOnKeep = true;
    const saved = draft();

    await useCase.execute({ proposed: saved, confirmed: saved, recordingUri: 'file:///take.wav' });

    // An entry without its audio is complete. An entry lost to a failed file
    // move is not.
    expect(await repository.findById(saved.id)).not.toBeNull();
  });
});

describe('ConfirmEntry', () => {
  it('is the step that actually writes the entry', async () => {
    const { repository, useCase } = setup();
    const proposed = draft();

    expect(await repository.findById('entry-1')).toBeNull();

    await useCase.execute({ proposed, confirmed: proposed });

    expect(await repository.findById('entry-1')).toBe(proposed);
  });

  it('logs nothing when the user accepted the card as offered', async () => {
    const { revisionLog, useCase } = setup();
    const proposed = draft();

    await useCase.execute({ proposed, confirmed: proposed });

    expect(revisionLog.records).toEqual([]);
  });

  it('records what Luna proposed against what the user kept', async () => {
    const { revisionLog, useCase } = setup();
    const proposed = draft();
    const confirmed = proposed.reviseWith({
      emotionIds: ['happy.proud'],
      mood: MoodScore.of(5),
    });

    await useCase.execute({ proposed, confirmed });

    expect(revisionLog.records).toEqual([
      {
        entryId: 'entry-1',
        revisedAt: NOW,
        proposedMood: 4,
        finalMood: 5,
        proposedEmotionIds: ['happy.proud', 'bad.tired'],
        finalEmotionIds: ['happy.proud'],
      },
    ]);
  });

  it('saves the revised entry, not the proposal it replaced', async () => {
    const { repository, useCase } = setup();
    const proposed = draft();
    const confirmed = proposed.reviseWith({ emotionIds: ['happy.proud'] });

    await useCase.execute({ proposed, confirmed });

    expect((await repository.findById('entry-1'))?.emotionIds).toEqual(['happy.proud']);
  });

  it('refuses to log a revision across two different entries', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ proposed: draft(), confirmed: draft({ id: 'entry-2' }) }),
    ).rejects.toThrow(MismatchedDraftError);
  });

  it('returns the entry it stored', async () => {
    const { useCase } = setup();
    const proposed = draft();

    expect(await useCase.execute({ proposed, confirmed: proposed })).toBe(proposed);
  });
});
