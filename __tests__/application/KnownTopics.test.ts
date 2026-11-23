import { KnownTopics } from '@/application/use-cases/KnownTopics';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';

function entry(id: string, day: number, contextTags: readonly string[]): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(2026, 10, day, 21, 15),
    source: 'voice',
    rawTranscript: 'long day',
    cleanTranscript: 'Long day.',
    mood: MoodScore.of(3),
    contextTags,
    confidence: Confidence.of(0.9),
  });
}

async function knownIn(...entries: readonly MoodEntry[]): Promise<readonly string[]> {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return new KnownTopics(repository).execute();
}

describe('the topics a journal already uses', () => {
  it('puts the one named in most entries first, each spelled the way it mostly is', async () => {
    const known = await knownIn(
      entry('a', 18, ['sleep', 'Work']),
      entry('b', 17, ['work']),
      entry('c', 16, ['work', 'walk']),
      entry('d', 15, ['sleep']),
    );

    expect(known).toEqual(['work', 'sleep', 'walk']);
  });

  it('counts an entry once however often it names a topic', async () => {
    const known = await knownIn(entry('a', 18, ['tea', 'tea', 'tea']), entry('b', 17, ['rain']), entry('c', 16, ['rain']));

    expect(known).toEqual(['rain', 'tea']);
  });

  it('breaks a tie alphabetically, so it reads the same twice', async () => {
    expect(await knownIn(entry('a', 18, ['walk', 'family']))).toEqual(['family', 'walk']);
  });

  it('is empty for a journal without topics', async () => {
    expect(await knownIn(entry('a', 18, []))).toEqual([]);
  });
});
