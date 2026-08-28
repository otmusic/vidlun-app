import { GetWeekThemes } from '@/application/use-cases/GetWeekThemes';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';

const WEEK_START = new Date(2026, 7, 24);
const WEEK_END = new Date(2026, 7, 31);

let nextId = 0;

function entry(day: number, contextTags: readonly string[]): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: new Date(2026, 7, day, 20, 0),
    source: 'voice',
    rawTranscript: 'anything',
    cleanTranscript: 'Anything.',
    mood: MoodScore.of(3),
    contextTags,
    confidence: Confidence.of(0.9),
  } satisfies MoodEntryProps);
}

async function themesOf(entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return new GetWeekThemes(repository).execute({ weekStart: WEEK_START, weekEnd: WEEK_END });
}

describe('what the week was about', () => {
  it('counts the entries a tag was named in, heaviest first', async () => {
    const themes = await themesOf([
      entry(24, ['work', 'sleep']),
      entry(25, ['work']),
      entry(26, ['work', 'sleep']),
    ]);

    expect(themes).toEqual([
      { tag: 'work', entryCount: 3 },
      { tag: 'sleep', entryCount: 2 },
    ]);
  });

  it('leaves out what was said once, because that is a day and not a theme', async () => {
    const themes = await themesOf([entry(24, ['work', 'dentist']), entry(25, ['work'])]);

    expect(themes).toEqual([{ tag: 'work', entryCount: 2 }]);
  });

  it('counts an emphatic entry once, not once per mention', async () => {
    const themes = await themesOf([entry(24, ['work', 'work', 'work']), entry(25, ['work'])]);

    expect(themes).toEqual([{ tag: 'work', entryCount: 2 }]);
  });

  it('renders the same week the same way twice', async () => {
    const themes = await themesOf([
      entry(24, ['sleep', 'work']),
      entry(25, ['work', 'sleep']),
    ]);

    // Ties break on the word, not on which entry happened to be saved first.
    expect(themes.map((theme) => theme.tag)).toEqual(['sleep', 'work']);
  });

  it('says nothing at all about a week with nothing in it', async () => {
    expect(await themesOf([])).toEqual([]);
  });
});
