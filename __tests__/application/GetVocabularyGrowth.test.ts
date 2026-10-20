import { GetVocabularyGrowth } from '@/application/use-cases/GetVocabularyGrowth';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { FixedClock } from './fakes';

const TODAY = new Date(2026, 7, 28, 21, 0);
const LAST_MONTH = new Date(2026, 6, 12, 21, 0);

let nextId = 0;

function entry(createdAt: Date, overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt,
    source: 'voice',
    rawTranscript: 'anything',
    cleanTranscript: 'Anything.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

async function growthOver(entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return new GetVocabularyGrowth(repository, new FixedClock(TODAY)).execute();
}

describe('which emotions the period held, and how often', () => {
  it('counts how often each emotion was on the period’s entries, the most frequent first', async () => {
    const growth = await growthOver([
      entry(LAST_MONTH, { emotionIds: ['sad'] }),
      entry(new Date(2026, 7, 3, 21, 0), { emotionIds: ['happy.content', 'bad.tired'] }),
      entry(new Date(2026, 7, 10, 21, 0), { emotionIds: ['bad.tired'] }),
      entry(TODAY, { selfEmotionIds: ['sad'], emotionIds: ['bad.tired', 'happy.content'] }),
    ]);

    // What the entries hold, not what was named unaided, and only this month.
    expect(growth.counts).toEqual([
      { id: 'bad.tired', count: 3 },
      { id: 'happy.content', count: 2 },
    ]);
  });

  it('puts the emotion named most recently first when two are as frequent', async () => {
    const growth = await growthOver([
      entry(new Date(2026, 7, 3, 21, 0), { emotionIds: ['sad'] }),
      entry(TODAY, { emotionIds: ['happy'] }),
    ]);

    expect(growth.counts.map((each) => each.id)).toEqual(['happy', 'sad']);
  });

  it('still counts a word that has since left the vocabulary', async () => {
    const growth = await growthOver([entry(TODAY, { emotionIds: ['compound.good_tired'] })]);

    expect(growth.counts).toEqual([{ id: 'compound.good_tired', count: 1 }]);
  });

  it('says it has nothing rather than showing a row of zeroes', async () => {
    const growth = await growthOver([entry(TODAY, { emotionIds: [] })]);

    expect(growth.counts).toEqual([]);
  });

  it('describes this month by default, not the day it was asked', async () => {
    const growth = await growthOver([entry(TODAY, { emotionIds: ['sad'] })]);

    expect(growth.from).toEqual(new Date(2026, 7, 1));
    // Exclusive and tomorrow, so an entry made minutes ago still counts.
    expect(growth.to).toEqual(new Date(2026, 7, 29));
    expect(growth.wide).toBe(false);
  });

  it('counts a wider period as one stretch', async () => {
    const repository = new InMemoryMoodEntryRepository();

    for (const each of [
      entry(LAST_MONTH, { emotionIds: ['sad'] }),
      entry(TODAY, { emotionIds: ['sad', 'happy'] }),
    ]) {
      await repository.save(each);
    }

    const growth = await new GetVocabularyGrowth(repository, new FixedClock(TODAY)).execute({
      from: new Date(2026, 6, 1),
      to: new Date(2026, 7, 29),
    });

    expect(growth.wide).toBe(true);
    expect(growth.counts).toEqual([
      { id: 'sad', count: 2 },
      { id: 'happy', count: 1 },
    ]);
  });
});
