import { FindMoodPatterns } from '@/application/use-cases/FindMoodPatterns';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
/** The stretch most tests read: all of August, long enough for every rule to show. */
const AUGUST = { weekStart: new Date(2026, 7, 1), weekEnd: new Date(2026, 8, 1) };

let nextId = 0;

function entry(
  day: number,
  mood: number,
  contextTags: readonly string[],
  emotionIds: readonly string[] = [],
  hour = 20,
): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: new Date(2026, 7, day, hour, 0),
    source: 'voice',
    rawTranscript: 'anything',
    cleanTranscript: 'Anything.',
    mood: MoodScore.of(mood),
    contextTags,
    emotionIds,
    confidence: Confidence.of(0.9),
  } satisfies MoodEntryProps);
}

async function patternsOf(entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return new FindMoodPatterns(repository).execute(AUGUST);
}

describe('what the month’s best and hardest days had in common', () => {
  it('names the topic all the hardest days carried', async () => {
    const hard = [entry(1, 2, ['work']), entry(2, 1, ['work', 'sleep']), entry(3, 2, ['work'])];
    const patterns = await patternsOf([
      ...hard,
      entry(4, 4, ['walk']),
      entry(5, 5, ['friends']),
      entry(6, 3, ['work']),
      entry(7, 4, []),
    ]);

    // Low or very low on three days, all three with work; work on one of the other four.
    expect(patterns[0]).toEqual({
      kind: 'days',
      side: 'hardest',
      tag: 'work',
      matching: 3,
      total: 3,
      entryIds: hard.map((each) => each.id),
    });
  });

  it('names the best days the same way', async () => {
    const patterns = await patternsOf([
      entry(1, 5, ['walk']),
      entry(2, 4, ['walk']),
      entry(3, 5, ['friends']),
      entry(4, 3, []),
      entry(5, 3, ['work']),
      entry(6, 3, ['work']),
    ]);

    expect(patterns[0]).toMatchObject({ kind: 'days', side: 'best', tag: 'walk', matching: 2, total: 3 });
  });

  it('counts a day once however many entries it holds', async () => {
    const patterns = await patternsOf([
      entry(1, 2, ['work'], [], 9),
      entry(1, 1, ['work'], [], 21),
      entry(2, 2, ['work']),
      entry(3, 4, []),
      entry(4, 4, []),
      entry(5, 3, []),
    ]);

    // Two hard days, not three hard entries: too few to say anything.
    expect(patterns.filter((each) => each.kind === 'days')).toEqual([]);
  });

  it('says nothing of a topic that was on every kind of day', async () => {
    const patterns = await patternsOf([
      entry(1, 2, ['work']),
      entry(2, 1, ['work']),
      entry(3, 2, ['work']),
      entry(4, 4, ['work']),
      entry(5, 5, ['work']),
      entry(6, 4, ['work']),
    ]);

    // Work on all of the hard days and all of the good ones is not about the hard days.
    expect(patterns.filter((each) => each.kind === 'days')).toEqual([]);
  });

  it('needs most of the days, not half of them', async () => {
    const patterns = await patternsOf([
      entry(1, 2, ['work']),
      entry(2, 1, ['work']),
      entry(3, 2, []),
      entry(4, 1, []),
      entry(5, 4, []),
      entry(6, 4, []),
      entry(7, 5, []),
    ]);

    expect(patterns.filter((each) => each.kind === 'days')).toEqual([]);
  });
});

describe('the emotion that keeps company with a topic', () => {
  it('names the emotion next to the first sentence’s topic', async () => {
    const tired = [
      entry(1, 2, ['work'], ['bad.tired']),
      entry(2, 1, ['work'], ['bad.tired', 'fearful.anxious']),
      entry(3, 2, ['work'], ['bad.tired']),
    ];
    const patterns = await patternsOf([
      ...tired,
      entry(4, 4, ['walk'], ['happy.peaceful']),
      entry(5, 5, ['friends'], ['happy.content']),
      entry(6, 4, [], ['happy.content']),
    ]);

    expect(patterns[1]).toEqual({
      kind: 'companion',
      tag: 'work',
      emotionId: 'bad.tired',
      matching: 3,
      total: 3,
      entryIds: tired.map((each) => each.id),
    });
  });

  it('finds a companion on its own when the days have nothing in common', async () => {
    const patterns = await patternsOf([
      entry(1, 3, ['sleep'], ['fearful.anxious']),
      entry(2, 3, ['sleep'], ['fearful.anxious']),
      entry(3, 3, ['sleep'], ['bad.tired']),
      entry(4, 3, ['work'], ['happy.content']),
      entry(5, 3, [], ['happy.content']),
      entry(6, 3, [], []),
    ]);

    expect(patterns).toEqual([
      expect.objectContaining({ kind: 'companion', tag: 'sleep', emotionId: 'fearful.anxious', matching: 2, total: 3 }),
    ]);
  });

  it('says nothing of an emotion that sits beside everything', async () => {
    const patterns = await patternsOf([
      entry(1, 3, ['work'], ['bad.tired']),
      entry(2, 3, ['work'], ['bad.tired']),
      entry(3, 3, ['work'], ['bad.tired']),
      entry(4, 3, [], ['bad.tired']),
      entry(5, 3, [], ['bad.tired']),
      entry(6, 3, [], ['bad.tired']),
    ]);

    expect(patterns).toEqual([]);
  });
});

describe('a month too thin to say anything about', () => {
  it('holds its tongue', async () => {
    expect(await patternsOf([entry(1, 5, ['walk']), entry(2, 1, [])])).toEqual([]);
  });
});

describe('the stretch a pattern is read over', () => {
  /*
   * From the owner's journal (2026-11-06): the week screen read the whole
   * month, so every October week said the same October sentence, and the
   * week of 5 October counted entries written weeks after it.
   */
  it('reads only the week asked about, not the rest of its month', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const hardWithWork = [entry(3, 1, ['work']), entry(4, 2, ['work']), entry(5, 1, ['work'])];
    const easyWithout = [entry(6, 4, ['sleep']), entry(7, 5, ['sleep']), entry(8, 4, ['sleep'])];
    const laterWeek = [entry(17, 4, ['walk']), entry(18, 3, ['walk']), entry(19, 4, ['walk'])];

    for (const each of [...hardWithWork, ...easyWithout, ...laterWeek]) {
      await repository.save(each);
    }

    const subject = new FindMoodPatterns(repository);

    expect(await subject.execute(AUGUST)).not.toEqual([]);
    expect(
      await subject.execute({ weekStart: new Date(2026, 7, 17), weekEnd: new Date(2026, 7, 24) }),
    ).toEqual([]);
  });
});
