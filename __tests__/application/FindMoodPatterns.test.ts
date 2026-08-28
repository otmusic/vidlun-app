import { FindMoodPatterns } from '@/application/use-cases/FindMoodPatterns';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { FixedClock } from './fakes';

const TODAY = new Date(2026, 7, 28, 21, 0);

let nextId = 0;

function entry(day: number, mood: number, contextTags: readonly string[]): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: new Date(2026, 7, day, 20, 0),
    source: 'voice',
    rawTranscript: 'anything',
    cleanTranscript: 'Anything.',
    mood: MoodScore.of(mood),
    contextTags,
    confidence: Confidence.of(0.9),
  } satisfies MoodEntryProps);
}

async function patternsOf(entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return new FindMoodPatterns(repository, new FixedClock(TODAY)).execute();
}

describe('what went together this month', () => {
  it('names a tag whose entries sit higher, and says how often', async () => {
    const patterns = await patternsOf([
      entry(1, 5, ['walk']),
      entry(2, 5, ['walk']),
      entry(3, 4, ['walk']),
      entry(4, 2, []),
      entry(5, 2, []),
      entry(6, 3, []),
    ]);

    expect(patterns).toEqual([
      { tag: 'walk', direction: 'higher', occurrences: 3, difference: 2.3 },
    ]);
  });

  it('reads the other direction the same way', async () => {
    const patterns = await patternsOf([
      entry(1, 2, ['work']),
      entry(2, 2, ['work']),
      entry(3, 1, ['work']),
      entry(4, 4, []),
      entry(5, 4, []),
      entry(6, 5, []),
    ]);

    expect(patterns[0]).toMatchObject({ tag: 'work', direction: 'lower' });
  });

  it('says nothing about a difference nobody would notice', async () => {
    const patterns = await patternsOf([
      entry(1, 3, ['work']),
      entry(2, 3, ['work']),
      entry(3, 4, ['work']),
      entry(4, 3, []),
      entry(5, 3, []),
      entry(6, 3, []),
    ]);

    // A third of a point on a five point scale is not a thing anyone lives.
    expect(patterns).toEqual([]);
  });

  it('needs enough on both sides before it compares anything', async () => {
    const patterns = await patternsOf([
      entry(1, 5, ['walk']),
      entry(2, 5, ['walk']),
      entry(3, 1, []),
      entry(4, 1, []),
      entry(5, 1, []),
      entry(6, 1, []),
    ]);

    // Two entries is an anecdote, and arithmetic does not make it more.
    expect(patterns).toEqual([]);
  });

  it('compares a month against nothing rather than inventing a comparison', async () => {
    const patterns = await patternsOf([
      entry(1, 5, ['work']),
      entry(2, 5, ['work']),
      entry(3, 4, ['work']),
      entry(4, 1, ['work']),
      entry(5, 1, ['work']),
      entry(6, 1, ['work']),
    ]);

    // Tagged on every entry: there is no other side to be higher than.
    expect(patterns).toEqual([]);
  });

  it('holds its tongue until the month has something in it', async () => {
    expect(await patternsOf([entry(1, 5, ['walk']), entry(2, 1, [])])).toEqual([]);
  });
});
