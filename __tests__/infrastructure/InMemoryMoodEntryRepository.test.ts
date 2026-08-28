import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';

function entry(id: string, createdAt: Date, mood = 3): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt,
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Something happened today.',
    mood: MoodScore.of(mood),
    confidence: Confidence.of(0.9),
  });
}

const MONDAY = new Date(2026, 6, 27, 8, 0);
const WEDNESDAY = new Date(2026, 6, 29, 8, 0);
const FRIDAY = new Date(2026, 6, 31, 8, 0);

describe('InMemoryMoodEntryRepository', () => {
  it('returns null for an entry it never stored', async () => {
    const repository = new InMemoryMoodEntryRepository();

    expect(await repository.findById('missing')).toBeNull();
  });

  it('replaces an entry saved again under the same id', async () => {
    const repository = new InMemoryMoodEntryRepository();

    await repository.save(entry('entry-1', MONDAY, 2));
    await repository.save(entry('entry-1', MONDAY, 5));

    expect((await repository.findById('entry-1'))?.mood?.value).toBe(5);
    expect(await repository.findRecent(10)).toHaveLength(1);
  });

  it('lists recent entries newest first', async () => {
    const repository = new InMemoryMoodEntryRepository();

    await repository.save(entry('monday', MONDAY));
    await repository.save(entry('friday', FRIDAY));
    await repository.save(entry('wednesday', WEDNESDAY));

    expect((await repository.findRecent(10)).map((found) => found.id)).toEqual([
      'friday',
      'wednesday',
      'monday',
    ]);
  });

  it('stops at the number of recent entries asked for', async () => {
    const repository = new InMemoryMoodEntryRepository();

    await repository.save(entry('monday', MONDAY));
    await repository.save(entry('friday', FRIDAY));

    expect((await repository.findRecent(1)).map((found) => found.id)).toEqual(['friday']);
  });

  it('includes the start of a range and excludes the end', async () => {
    const repository = new InMemoryMoodEntryRepository();

    await repository.save(entry('start', MONDAY));
    await repository.save(entry('inside', WEDNESDAY));
    await repository.save(entry('end', FRIDAY));

    const found = await repository.findBetween(MONDAY, FRIDAY);

    expect(found.map((each) => each.id)).toEqual(['inside', 'start']);
  });
});
