import { GetPastMonths } from '@/application/use-cases/GetPastMonths';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock } from './fakes';

/** 6 October: September is over, October is not. */
const OCTOBER = new Date(2026, 9, 6, 17, 0);

let nextId = 0;

function entryOn(date: Date): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: date,
    source: 'text',
    rawTranscript: 'raw',
    cleanTranscript: 'Something happened.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(1),
  });
}

async function pastMonthsOf(dates: readonly Date[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const date of dates) {
    await repository.save(entryOn(date));
  }

  return new GetPastMonths(repository, new FixedClock(OCTOBER)).execute();
}

describe('GetPastMonths', () => {
  it('lists the finished months, newest first, with how much each holds', async () => {
    const months = await pastMonthsOf([
      new Date(2026, 7, 2, 9, 0),
      new Date(2026, 7, 12, 9, 0),
      new Date(2026, 7, 31, 23, 0),
      new Date(2026, 8, 1, 0, 30),
      new Date(2026, 8, 15, 9, 0),
      new Date(2026, 8, 20, 9, 0),
      new Date(2026, 8, 30, 21, 0),
    ]);

    expect(months).toEqual([
      { monthStart: new Date(2026, 8, 1), entryCount: 4 },
      { monthStart: new Date(2026, 7, 1), entryCount: 3 },
    ]);
  });

  it('leaves out the month still running, however full', async () => {
    const months = await pastMonthsOf([
      new Date(2026, 9, 1, 9, 0),
      new Date(2026, 9, 2, 9, 0),
      new Date(2026, 9, 3, 9, 0),
    ]);

    expect(months).toEqual([]);
  });

  it('leaves out a month too thin for its piece to be written', async () => {
    const months = await pastMonthsOf([new Date(2026, 6, 4, 9, 0), new Date(2026, 6, 9, 9, 0)]);

    expect(months).toEqual([]);
  });
});
