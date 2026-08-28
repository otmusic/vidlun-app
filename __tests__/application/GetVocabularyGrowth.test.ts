import { GetVocabularyGrowth } from '@/application/use-cases/GetVocabularyGrowth';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { FixedClock } from './fakes';

const TODAY = new Date(2026, 7, 28, 21, 0);
const LAST_MONTH = new Date(2026, 6, 12, 21, 0);

const vocabulary = createEmotionVocabulary();

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

  return new GetVocabularyGrowth(repository, vocabulary, new FixedClock(TODAY)).execute();
}

describe('how the person’s own vocabulary is changing', () => {
  it('counts only what they named unaided, never what they took from Vidlun', async () => {
    const growth = await growthOver([
      entry(TODAY, { selfEmotionIds: ['sad'], emotionIds: ['sad', 'bad.tired'] }),
    ]);

    /*
     * The kept set is a mix of their word and Vidlun's after the reveal, and
     * counting it would file our vocabulary as theirs — which is the whole
     * reason §3b keeps the three fields apart.
     */
    expect(growth.distinctCount).toBe(1);
    expect(growth.firstTimeIds).toEqual(['sad']);
  });

  it('calls a word new only when no earlier month held it', async () => {
    const growth = await growthOver([
      entry(LAST_MONTH, { selfEmotionIds: ['sad'] }),
      entry(TODAY, { selfEmotionIds: ['sad', 'happy'] }),
    ]);

    expect(growth.firstTimeIds).toEqual(['happy']);
  });

  it('reads a broad word replaced by one of its children as a refinement', async () => {
    const growth = await growthOver([
      entry(LAST_MONTH, { selfEmotionIds: ['happy.proud'] }),
      entry(TODAY, { selfEmotionIds: ['happy.proud.confident'] }),
    ]);

    expect(growth.refinements).toEqual([{ fromId: 'happy.proud', toId: 'happy.proud.confident' }]);
  });

  it('does not call it a refinement while the broad word is still in use', async () => {
    const growth = await growthOver([
      entry(LAST_MONTH, { selfEmotionIds: ['happy.proud'] }),
      entry(TODAY, { selfEmotionIds: ['happy.proud', 'happy.proud.confident'] }),
    ]);

    // Using both is a month with two feelings in it, not a trade. Reporting a
    // trade would be an insight nobody had.
    expect(growth.refinements).toEqual([]);
  });

  it('never reads going broader as going deeper', async () => {
    const growth = await growthOver([
      entry(LAST_MONTH, { selfEmotionIds: ['happy.proud.confident'] }),
      entry(TODAY, { selfEmotionIds: ['happy.proud'] }),
    ]);

    expect(growth.refinements).toEqual([]);
  });

  it('counts the words that were more than a root word', async () => {
    const growth = await growthOver([
      entry(TODAY, { selfEmotionIds: ['sad', 'bad.tired', 'happy.proud.confident'] }),
    ]);

    expect(growth).toMatchObject({ distinctCount: 3, preciseCount: 2 });
  });

  it('says it has nothing rather than showing a row of zeroes', async () => {
    const growth = await growthOver([entry(TODAY, { selfEmotionIds: [] })]);

    expect(growth).toMatchObject({ hasAnything: false, distinctCount: 0, firstTimeIds: [] });
  });

  it('describes this month by default, not the day it was asked', async () => {
    const growth = await growthOver([entry(TODAY, { selfEmotionIds: ['sad'] })]);

    expect(growth.from).toEqual(new Date(2026, 7, 1));
    // Exclusive and tomorrow, so an entry made minutes ago still counts.
    expect(growth.to).toEqual(new Date(2026, 7, 29));
    expect(growth.wide).toBe(false);
  });

  it('counts each month of a wider period on its own', async () => {
    const repository = new InMemoryMoodEntryRepository();

    for (const each of [
      entry(LAST_MONTH, { selfEmotionIds: ['sad'] }),
      entry(TODAY, { selfEmotionIds: ['sad', 'happy'] }),
    ]) {
      await repository.save(each);
    }

    const growth = await new GetVocabularyGrowth(
      repository,
      vocabulary,
      new FixedClock(TODAY),
    ).execute({ from: new Date(2026, 6, 1), to: new Date(2026, 7, 29) });

    expect(growth.wide).toBe(true);
    expect(growth.months).toEqual([
      { monthStart: new Date(2026, 6, 1), distinctCount: 1 },
      { monthStart: new Date(2026, 7, 1), distinctCount: 2 },
    ]);
    // Both words are new against everything before July, and the period is one
    // stretch rather than two months compared with each other.
    expect([...growth.firstTimeIds].sort()).toEqual(['happy', 'sad']);
  });

  it('names the root the person really used, and only when it opened out', async () => {
    const repository = new InMemoryMoodEntryRepository();

    for (const each of [
      entry(new Date(2026, 6, 3), { selfEmotionIds: ['happy'] }),
      entry(new Date(2026, 7, 4), { selfEmotionIds: ['happy.proud'] }),
      entry(TODAY, { selfEmotionIds: ['happy.content'] }),
    ]) {
      await repository.save(each);
    }

    const growth = await new GetVocabularyGrowth(
      repository,
      vocabulary,
      new FixedClock(TODAY),
    ).execute({ from: new Date(2026, 6, 1), to: new Date(2026, 7, 29) });

    expect(growth.widening).toEqual({
      rootId: 'happy',
      intoIds: ['happy.content', 'happy.proud'],
    });
  });

  it('says nothing about a root that only went one step deeper', async () => {
    const repository = new InMemoryMoodEntryRepository();

    for (const each of [
      entry(new Date(2026, 6, 3), { selfEmotionIds: ['happy'] }),
      entry(TODAY, { selfEmotionIds: ['happy.proud'] }),
    ]) {
      await repository.save(each);
    }

    const growth = await new GetVocabularyGrowth(
      repository,
      vocabulary,
      new FixedClock(TODAY),
    ).execute({ from: new Date(2026, 6, 1), to: new Date(2026, 7, 29) });

    /*
     * One finer word is going deeper, not telling two things apart, and the
     * sentence would have said "different things" of a single one. Nor is it a
     * It is a refinement, though: August is measured against everything before
     * August, and the broad word being inside the same period does not hide it.
     */
    expect(growth.widening).toBeNull();
    expect(growth.refinements).toEqual([{ fromId: 'happy', toId: 'happy.proud' }]);
  });

  it('claims no widening of a root nobody used', async () => {
    const repository = new InMemoryMoodEntryRepository();

    for (const each of [
      entry(new Date(2026, 6, 3), { selfEmotionIds: ['sad'] }),
      entry(TODAY, { selfEmotionIds: ['happy.proud', 'happy.content'] }),
    ]) {
      await repository.save(each);
    }

    const growth = await new GetVocabularyGrowth(
      repository,
      vocabulary,
      new FixedClock(TODAY),
    ).execute({ from: new Date(2026, 6, 1), to: new Date(2026, 7, 29) });

    // The new words are real, but "it used to be simply happy" would be about
    // a month in which they never said it.
    expect(growth.widening).toBeNull();
  });

  it('sees a trade that happened inside the period, not only before it', async () => {
    const repository = new InMemoryMoodEntryRepository();

    for (const each of [
      entry(new Date(2026, 5, 8), { selfEmotionIds: ['bad.tired'] }),
      entry(new Date(2026, 7, 4), { selfEmotionIds: ['happy.proud.confident'] }),
      entry(new Date(2026, 6, 9), { selfEmotionIds: ['happy.proud'] }),
    ]) {
      await repository.save(each);
    }

    const growth = await new GetVocabularyGrowth(
      repository,
      vocabulary,
      new FixedClock(TODAY),
    ).execute({ from: new Date(2026, 5, 1), to: new Date(2026, 7, 29) });

    /*
     * July's word and August's finer one both sit inside the chosen three
     * months. Comparing the period against what came before it saw nothing.
     */
    expect(growth.refinements).toEqual([
      { fromId: 'happy.proud', toId: 'happy.proud.confident' },
    ]);
  });
});
