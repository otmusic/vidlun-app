import { GetWeekSummary } from '@/application/use-cases/GetWeekSummary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock, StubNarrativeGenerator } from './fakes';

/** Friday 31 July 2026, so the week under test runs Mon 27 to Sun 2 August. */
const FRIDAY = new Date(2026, 6, 31, 20, 15);
const MONDAY = new Date(2026, 6, 27, 0, 0);

let nextId = 0;

function entryOn(date: Date, mood: number, emotionIds: readonly string[] = []): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: date,
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Something happened today.',
    mood: MoodScore.of(mood),
    confidence: Confidence.of(0.9),
    emotionIds,
  });
}

async function setup(entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const entry of entries) {
    await repository.save(entry);
  }

  const narrativeGenerator = new StubNarrativeGenerator();

  return {
    narrativeGenerator,
    useCase: new GetWeekSummary(repository, narrativeGenerator, new FixedClock(FRIDAY)),
  };
}

describe('GetWeekSummary', () => {
  it('runs the week from Monday to Sunday around today', async () => {
    const { useCase } = await setup([]);

    const summary = await useCase.execute({ withNarrative: false });

    expect(summary.weekStart).toEqual(MONDAY);
    expect(summary.weekEnd).toEqual(new Date(2026, 7, 3, 0, 0));
    expect(summary.days).toHaveLength(7);
  });

  it('averages a day with several entries instead of showing only the last', async () => {
    const { useCase } = await setup([
      entryOn(new Date(2026, 6, 29, 9, 0), 2),
      entryOn(new Date(2026, 6, 29, 22, 0), 3),
    ]);

    const summary = await useCase.execute({ withNarrative: false });

    expect(summary.days[2]).toEqual({
      date: new Date(2026, 6, 29, 0, 0),
      averageMood: 2.5,
      entryCount: 2,
      topEmotionId: null,
    });
  });

  it('leaves an untracked day empty rather than scoring it', async () => {
    const { useCase } = await setup([entryOn(new Date(2026, 6, 27, 8, 0), 5)]);

    const summary = await useCase.execute({ withNarrative: false });

    expect(summary.days[0]?.averageMood).toBe(5);
    expect(summary.days[1]).toEqual({
      date: new Date(2026, 6, 28, 0, 0),
      averageMood: null,
      entryCount: 0,
      topEmotionId: null,
    });
  });

  it('ignores entries from the weeks either side', async () => {
    const { useCase } = await setup([
      entryOn(new Date(2026, 6, 26, 23, 0), 1),
      entryOn(new Date(2026, 6, 27, 8, 0), 5),
      entryOn(new Date(2026, 7, 3, 0, 30), 1),
    ]);

    const summary = await useCase.execute({ withNarrative: false });

    expect(summary.entryCount).toBe(1);
  });

  it('reads any day into the week that contains it', async () => {
    const { useCase } = await setup([entryOn(new Date(2026, 6, 22, 8, 0), 5)]);

    const summary = await useCase.execute({
      withNarrative: false,
      containing: new Date(2026, 6, 24, 12, 0),
    });

    expect(summary.weekStart).toEqual(new Date(2026, 6, 20, 0, 0));
    expect(summary.entryCount).toBe(1);
  });

  it('gives the daily trend away for free', async () => {
    const { narrativeGenerator, useCase } = await setup([entryOn(new Date(2026, 6, 27, 8, 0), 5)]);

    const summary = await useCase.execute({ withNarrative: false });

    expect(summary.days[0]?.averageMood).toBe(5);
    expect(summary.narrative).toBeNull();
    expect(narrativeGenerator.calls).toEqual([]);
  });

  it('writes the narrative only when it was asked for', async () => {
    const { narrativeGenerator, useCase } = await setup([entryOn(new Date(2026, 6, 27, 8, 0), 5)]);

    const summary = await useCase.execute({ withNarrative: true });

    expect(summary.narrative).toBe('Calmer mornings, tense evenings.');
    expect(narrativeGenerator.calls).toHaveLength(1);
  });

  it('does not pay a model to summarise an empty week', async () => {
    const { narrativeGenerator, useCase } = await setup([]);

    const summary = await useCase.execute({ withNarrative: true });

    expect(summary.narrative).toBeNull();
    expect(narrativeGenerator.calls).toEqual([]);
  });

  it('hands the week to the model oldest first, the way it reads', async () => {
    const { narrativeGenerator, useCase } = await setup([
      entryOn(new Date(2026, 6, 31, 8, 0), 3),
      entryOn(new Date(2026, 6, 27, 8, 0), 5),
    ]);

    await useCase.execute({ withNarrative: true });

    expect(narrativeGenerator.calls[0]?.map((entry) => entry.createdAt)).toEqual([
      new Date(2026, 6, 27, 8, 0),
      new Date(2026, 6, 31, 8, 0),
    ]);
  });
  it('names the day by its most-named emotion', async () => {
    const { useCase } = await setup([
      entryOn(new Date(2026, 6, 29, 9, 0), 3, ['bad.tired']),
      entryOn(new Date(2026, 6, 29, 20, 0), 4, ['happy.calm', 'bad.tired']),
    ]);

    const summary = await useCase.execute({ withNarrative: false });

    expect(summary.days[2]?.topEmotionId).toBe('bad.tired');
  });

  it('lets the later entry name the day when the count is even', async () => {
    // The fresher word for the day, not the alphabetically luckier one.
    const { useCase } = await setup([
      entryOn(new Date(2026, 6, 29, 9, 0), 3, ['happy.calm']),
      entryOn(new Date(2026, 6, 29, 20, 0), 4, ['bad.tired']),
    ]);

    const summary = await useCase.execute({ withNarrative: false });

    expect(summary.days[2]?.topEmotionId).toBe('bad.tired');
  });
});
