import { GetHistory } from '@/application/use-cases/GetHistory';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';

function entry(id: string, createdAt: string): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(createdAt),
    source: 'voice',
    rawTranscript: 'raw words',
    cleanTranscript: 'Finished three tasks.',
    mood: MoodScore.of(4),
    confidence: Confidence.of(0.9),
  });
}

async function historyOf(...entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const one of entries) {
    await repository.save(one);
  }

  return new GetHistory(repository).execute();
}

describe('GetHistory', () => {
  it('has nothing to show on a fresh install', async () => {
    expect(await historyOf()).toEqual([]);
  });

  it('puts the entries of one day together', async () => {
    const days = await historyOf(
      entry('a', '2026-08-25T09:00:00'),
      entry('b', '2026-08-25T21:00:00'),
    );

    expect(days).toHaveLength(1);
    expect(days[0]?.entries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('keeps separate days separate, newest first', async () => {
    const days = await historyOf(
      entry('older', '2026-08-24T09:00:00'),
      entry('newer', '2026-08-25T09:00:00'),
    );

    expect(days.map((d) => d.entries[0]?.id)).toEqual(['newer', 'older']);
  });

  it('splits entries either side of local midnight', async () => {
    const days = await historyOf(
      entry('late', '2026-08-24T23:50:00'),
      entry('early', '2026-08-25T00:10:00'),
    );

    expect(days).toHaveLength(2);
  });

  it('labels each day with its own local midnight', async () => {
    const days = await historyOf(entry('a', '2026-08-25T21:00:00'));
    const day = days[0]?.day;

    expect(day?.getHours()).toBe(0);
    expect(day?.getDate()).toBe(25);
  });

  it('returns the whole journal, not a recent slice', async () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      entry(`e${i}`, `2026-07-${String((i % 28) + 1).padStart(2, '0')}T09:00:00`),
    );

    const days = await historyOf(...many);

    expect(days.reduce((n, d) => n + d.entries.length, 0)).toBe(40);
  });
});
