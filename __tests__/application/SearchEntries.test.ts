import { SearchEntries } from '@/application/use-cases/SearchEntries';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';

let nextId = 0;

function entry(overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: new Date(2026, 7, nextId, 20, 0),
    source: 'voice',
    rawTranscript: 'raw words nobody typed',
    cleanTranscript: 'Finished three tasks.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

async function search(entries: readonly MoodEntry[], input = {}) {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return new SearchEntries(repository).execute(input);
}

describe('finding an entry again', () => {
  it('matches a word in the sentence, whatever the case', async () => {
    const result = await search([
      entry({ cleanTranscript: 'Cooked dinner.' }),
      entry({ cleanTranscript: 'Finished three tasks.' }),
    ]);

    expect((await search([entry({ cleanTranscript: 'Cooked dinner.' })], { query: 'COOK' })).entries)
      .toHaveLength(1);
    expect(result.entries).toHaveLength(2);
  });

  it('matches a context tag, which is how people remember what it was about', async () => {
    const result = await search(
      [entry({ contextTags: ['work'] }), entry({ contextTags: ['sleep'] })],
      { query: 'work' },
    );

    expect(result.entries).toHaveLength(1);
  });

  it('never searches the raw transcript', async () => {
    const result = await search(
      [entry({ rawTranscript: 'mishearing', cleanTranscript: 'Cooked dinner.' })],
      { query: 'mishearing' },
    );

    // A card returned on a word that is not in it would be the app claiming
    // the person said something they cannot see.
    expect(result.entries).toEqual([]);
  });

  it('narrows to one feeling when asked', async () => {
    const result = await search(
      [entry({ emotionIds: ['bad.tired'] }), entry({ emotionIds: ['happy'] })],
      { emotionId: 'happy' },
    );

    expect(result.entries).toHaveLength(1);
  });

  it('offers the words this person actually uses, most used first', async () => {
    const result = await search([
      entry({ emotionIds: ['bad.tired', 'happy'] }),
      entry({ emotionIds: ['bad.tired'] }),
      entry({ emotionIds: ['sad'] }),
    ]);

    expect(result.filterIds).toEqual(['bad.tired', 'happy', 'sad']);
  });

  it('offers nothing to narrow by in an empty journal', async () => {
    expect(await search([])).toEqual({ entries: [], filterIds: [] });
  });
});
