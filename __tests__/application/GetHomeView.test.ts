import { GetHomeView } from '@/application/use-cases/GetHomeView';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock, InMemoryRecordingStore } from './fakes';

/** Saturday 1 August 2026, mid-morning. */
const TODAY = new Date(2026, 7, 1, 10, 0);

let nextId = 0;

function entryOn(date: Date): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: date,
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Something happened today.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(0.9),
  });
}

function daysBefore(days: number, hour = 9): Date {
  return new Date(2026, 7, 1 - days, hour, 0);
}

async function setup(entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const entry of entries) {
    await repository.save(entry);
  }

  return new GetHomeView(repository, new FixedClock(TODAY), new InMemoryRecordingStore());
}

describe('GetHomeView', () => {
  it('has no streak before the first entry', async () => {
    const useCase = await setup([]);

    const view = await useCase.execute(3);

    expect(view.streakDays).toBe(0);
    expect(view.recentEntries).toEqual([]);
  });

  it('counts consecutive days ending today', async () => {
    const useCase = await setup([entryOn(daysBefore(0)), entryOn(daysBefore(1)), entryOn(daysBefore(2))]);

    expect((await useCase.execute(3)).streakDays).toBe(3);
  });

  it('keeps the streak alive all morning before today has an entry', async () => {
    const useCase = await setup([entryOn(daysBefore(1)), entryOn(daysBefore(2))]);

    expect((await useCase.execute(3)).streakDays).toBe(2);
  });

  it('breaks the streak after a full day is missed', async () => {
    const useCase = await setup([entryOn(daysBefore(2)), entryOn(daysBefore(3))]);

    expect((await useCase.execute(3)).streakDays).toBe(0);
  });

  it('counts a day once, however many entries it holds', async () => {
    const useCase = await setup([entryOn(daysBefore(0, 8)), entryOn(daysBefore(0, 21))]);

    expect((await useCase.execute(3)).streakDays).toBe(1);
  });

  it('returns the newest entries up to the limit asked for', async () => {
    const useCase = await setup([entryOn(daysBefore(0)), entryOn(daysBefore(1)), entryOn(daysBefore(2))]);

    const view = await useCase.execute(2);

    expect(view.recentEntries).toHaveLength(2);
    expect(view.recentEntries[0]?.createdAt.getDate()).toBe(1);
  });
});

describe('GetHomeView week strip', () => {
  it('covers the seven days ending today, oldest first', async () => {
    const useCase = await setup([]);

    const view = await useCase.execute(3);

    expect(view.week).toHaveLength(7);
    expect(view.week[0]?.date.getDate()).toBe(new Date(2026, 6, 26).getDate());
    expect(view.week[6]?.date.getDate()).toBe(TODAY.getDate());
  });

  it('leaves a day without an entry without a mood, rather than at zero', async () => {
    const useCase = await setup([entryOn(daysBefore(0))]);

    const view = await useCase.execute(3);

    expect(view.week[6]?.averageMood).toBe(3);
    expect(view.week[5]?.averageMood).toBeNull();
    expect(view.week[5]?.entryCount).toBe(0);
  });

  it('averages a day that holds more than one entry', async () => {
    const useCase = await setup([
      entryOn(daysBefore(0, 9)),
      entryOn(daysBefore(0, 21)),
    ]);

    const view = await useCase.execute(3);

    expect(view.week[6]?.entryCount).toBe(2);
    expect(view.week[6]?.averageMood).toBe(3);
  });
});

describe('the echo from a month ago', () => {
  it('hands back the entry written a month ago today', async () => {
    const useCase = await setup([entryOn(new Date(2026, 6, 1, 21, 0))]);

    const view = await useCase.execute(3);

    expect(view.echo?.createdAt).toEqual(new Date(2026, 6, 1, 21, 0));
  });

  it("lets the day's last entry speak for it", async () => {
    const useCase = await setup([
      entryOn(new Date(2026, 6, 1, 9, 0)),
      entryOn(new Date(2026, 6, 1, 22, 15)),
    ]);

    const view = await useCase.execute(3);

    expect(view.echo?.createdAt.getHours()).toBe(22);
  });

  it('stays silent on a day the previous month never had', async () => {
    const repository = new InMemoryMoodEntryRepository();

    // 31 July exists; 31 June does not. Looking from 31 July at "a month
    // ago" must not slide to 1 July or 30 June.
    await repository.save(entryOn(new Date(2026, 6, 1, 9, 0)));
    await repository.save(entryOn(new Date(2026, 5, 30, 9, 0)));

    const view = await new GetHomeView(
      repository,
      new FixedClock(new Date(2026, 6, 31, 10, 0)),
      new InMemoryRecordingStore(),
    ).execute(3);

    expect(view.echo).toBeNull();
  });

  it('stays silent when that day simply held nothing', async () => {
    const useCase = await setup([entryOn(new Date(2026, 6, 2, 9, 0))]);

    const view = await useCase.execute(3);

    expect(view.echo).toBeNull();
  });
});

describe('the echo from a year ago', () => {
  it('brings back that day and its voice when the phone still has it', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const recordings = new InMemoryRecordingStore();
    const thatDay = entryOn(new Date(2025, 7, 1, 8, 40));
    await repository.save(thatDay);
    await recordings.keep(thatDay.id, 'file:///recordings/that-day.wav');

    const view = await new GetHomeView(repository, new FixedClock(TODAY), recordings).execute(3);

    expect(view.yearEcho?.entry.id).toBe(thatDay.id);
    expect(view.yearEcho?.recordingUri).toBe('file:///recordings/that-day.wav');
  });

  it('brings back the words alone once the voice is gone', async () => {
    const useCase = await setup([entryOn(new Date(2025, 7, 1, 8, 40))]);

    const view = await useCase.execute(3);

    expect(view.yearEcho?.recordingUri).toBeNull();
  });

  it('takes the last entry of that day', async () => {
    const morning = entryOn(new Date(2025, 7, 1, 8, 0));
    const evening = entryOn(new Date(2025, 7, 1, 21, 0));
    const useCase = await setup([morning, evening]);

    expect((await useCase.execute(3)).yearEcho?.entry.id).toBe(evening.id);
  });

  it('is silent when that day held nothing, or on a leap day', async () => {
    const useCase = await setup([entryOn(new Date(2025, 7, 2, 9, 0))]);

    expect((await useCase.execute(3)).yearEcho).toBeNull();

    const leap = await new GetHomeView(
      new InMemoryMoodEntryRepository(),
      new FixedClock(new Date(2028, 1, 29, 10, 0)),
      new InMemoryRecordingStore(),
    ).execute(3);

    expect(leap.yearEcho).toBeNull();
  });
});
