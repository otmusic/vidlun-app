import { GetMonthSummary } from '@/application/use-cases/GetMonthSummary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock, StubNarrativeGenerator } from './fakes';

/** 3 September: the August piece is still fresh. */
const EARLY_SEPTEMBER = new Date(2026, 8, 3, 10, 0);

let nextId = 0;

function entryOn(date: Date): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: date,
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Something happened.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(0.9),
  });
}

async function setup(entries: readonly MoodEntry[], now = EARLY_SEPTEMBER) {
  const repository = new InMemoryMoodEntryRepository();

  for (const entry of entries) {
    await repository.save(entry);
  }

  const generator = new StubNarrativeGenerator();

  return { generator, useCase: new GetMonthSummary(repository, generator, new FixedClock(now)) };
}

describe('GetMonthSummary', () => {
  it('is fresh in the first week of a month and rests after', async () => {
    const early = await setup([], new Date(2026, 8, 7, 9, 0));
    const late = await setup([], new Date(2026, 8, 8, 9, 0));

    expect(early.useCase.isFresh()).toBe(true);
    expect(late.useCase.isFresh()).toBe(false);
  });

  it('writes about the previous month and nothing else', async () => {
    const { generator, useCase } = await setup([
      entryOn(new Date(2026, 7, 5, 9, 0)),
      entryOn(new Date(2026, 7, 20, 9, 0)),
      entryOn(new Date(2026, 7, 30, 9, 0)),
      entryOn(new Date(2026, 8, 1, 9, 0)),
      entryOn(new Date(2026, 6, 30, 9, 0)),
    ]);

    const month = await useCase.execute({ withNarrative: true });

    expect(month.monthStart).toEqual(new Date(2026, 7, 1));
    expect(month.entryCount).toBe(3);
    expect(month.narrative).not.toBeNull();
    expect(generator.calls[0]).toHaveLength(3);
    // Oldest first, the way a month reads.
    expect(generator.calls[0]?.[0]?.createdAt).toEqual(new Date(2026, 7, 5, 9, 0));
  });

  it('does not pay the model for a month too thin to read', async () => {
    const { generator, useCase } = await setup([entryOn(new Date(2026, 7, 5, 9, 0))]);

    const month = await useCase.execute({ withNarrative: true });

    expect(month.hasEnough).toBe(false);
    expect(month.narrative).toBeNull();
    expect(generator.calls).toHaveLength(0);
  });

  it('hands the shape without prose when not asked for it', async () => {
    const { generator, useCase } = await setup([
      entryOn(new Date(2026, 7, 5, 9, 0)),
      entryOn(new Date(2026, 7, 6, 9, 0)),
      entryOn(new Date(2026, 7, 7, 9, 0)),
    ]);

    const month = await useCase.execute({ withNarrative: false });

    expect(month.hasEnough).toBe(true);
    expect(month.narrative).toBeNull();
    expect(generator.calls).toHaveLength(0);
  });
});
