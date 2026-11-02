import { GetWeekNeighbours } from '@/application/use-cases/GetWeekNeighbours';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock } from './fakes';

/** Friday 30 October 2026: this week runs Mon 26 October to Sun 1 November. */
const NOW = new Date(2026, 9, 30, 12, 0);

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

async function neighbours(entries: readonly MoodEntry[], weeksBack: number) {
  const repository = new InMemoryMoodEntryRepository();

  for (const entry of entries) {
    await repository.save(entry);
  }

  return new GetWeekNeighbours(repository, new FixedClock(NOW)).execute({ weeksBack });
}

describe('GetWeekNeighbours', () => {
  /*
   * From the owner's own journal (2026-10-30): nothing was written in the week
   * of 19 October, and the arrow back from this week went dead, so 6 October
   * and everything before it could no longer be reached from the week screen.
   */
  it('steps back over empty weeks to the nearest one with entries', async () => {
    const result = await neighbours([entryOn(new Date(2026, 9, 6, 17, 7))], 0);

    expect(result.earlierWeeksBack).toBe(3);
  });

  it('steps forward over empty weeks to the nearest one with entries', async () => {
    const result = await neighbours(
      [entryOn(new Date(2026, 9, 6, 17, 7)), entryOn(new Date(2026, 8, 14, 9, 0))],
      6,
    );

    expect(result.laterWeeksBack).toBe(3);
  });

  it('steps forward to this week when nothing later was written, empty or not', async () => {
    const result = await neighbours([entryOn(new Date(2026, 9, 6, 17, 7))], 3);

    expect(result.laterWeeksBack).toBe(0);
  });

  it('has nothing to step back to before the journal began', async () => {
    const result = await neighbours([entryOn(new Date(2026, 9, 6, 17, 7))], 3);

    expect(result.earlierWeeksBack).toBeNull();
  });

  it('has nothing to step forward to from this week', async () => {
    const result = await neighbours([entryOn(new Date(2026, 9, 27, 9, 0))], 0);

    expect(result.laterWeeksBack).toBeNull();
  });

  it('counts a Sunday-night entry in the week it belongs to', async () => {
    const result = await neighbours([entryOn(new Date(2026, 9, 25, 23, 30))], 0);

    expect(result.earlierWeeksBack).toBe(1);
  });

  it('counts whole weeks across the clock change at the end of October', async () => {
    // Europe moved its clocks back on 25 October 2026; a week that spans it
    // is an hour longer, and must still count as one week.
    const result = await neighbours([entryOn(new Date(2026, 9, 21, 12, 0))], 0);

    expect(result.earlierWeeksBack).toBe(1);
  });
});
