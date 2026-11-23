import { GetMonthVoice } from '@/application/use-cases/GetMonthVoice';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { InMemoryRecordingStore } from './fakes';

function entryOn(id: string, date: Date, overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: date,
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Something happened.',
    mood: null,
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

/** Measures every take as a minute long, except the ones it is told cannot be read. */
class MinuteLongTakes {
  unreadable = new Set<string>();
  absent = false;
  readonly asked: (readonly string[])[] = [];

  lengths(uris: readonly string[]): Promise<readonly (number | null)[] | null> {
    this.asked.push(uris);

    return Promise.resolve(this.absent ? null : uris.map((uri) => (this.unreadable.has(uri) ? null : 60_000)));
  }
}

async function setUp(entries: readonly MoodEntry[], withVoice: readonly string[]) {
  const repository = new InMemoryMoodEntryRepository();
  const recordings = new InMemoryRecordingStore();
  const takes = new MinuteLongTakes();

  for (const entry of entries) {
    await repository.save(entry);
  }

  for (const id of withVoice) {
    await recordings.keep(id, `file:///recordings/${id}.m4a`);
  }

  return { takes, useCase: new GetMonthVoice(repository, recordings, takes) };
}

describe('GetMonthVoice', () => {
  it('hears the month’s spoken entries, first to last, and nothing typed', async () => {
    const { useCase } = await setUp(
      [
        entryOn('late', new Date(2026, 9, 28, 22, 0)),
        entryOn('typed', new Date(2026, 9, 12, 9, 0), { source: 'text' }),
        entryOn('early', new Date(2026, 9, 2, 8, 0)),
        entryOn('november', new Date(2026, 10, 1, 9, 0)),
      ],
      ['late', 'early', 'november'],
    );

    const voice = await useCase.execute(new Date(2026, 9, 15));

    expect(voice?.monthStart).toEqual(new Date(2026, 9, 1));
    expect(voice?.voiced.map(({ entry }) => entry.id)).toEqual(['early', 'late']);
    expect(voice?.voiced[0]).toMatchObject({ uri: 'file:///recordings/early.m4a', lengthMs: 60_000 });
  });

  it('hears the hard entries as much as any other', async () => {
    const { useCase } = await setUp(
      [
        entryOn('calm', new Date(2026, 9, 3)),
        entryOn('hard', new Date(2026, 9, 4), { safetyFlag: 'distress' }),
        entryOn('crisis', new Date(2026, 9, 5), { safetyFlag: 'crisis' }),
      ],
      ['calm', 'hard', 'crisis'],
    );

    const voice = await useCase.execute(new Date(2026, 9, 1));

    expect(voice?.voiced.map(({ entry }) => entry.id)).toEqual(['calm', 'hard', 'crisis']);
  });

  it('leaves out a take that cannot be read', async () => {
    const { useCase, takes } = await setUp(
      [entryOn('fine', new Date(2026, 9, 3)), entryOn('broken', new Date(2026, 9, 4))],
      ['fine', 'broken'],
    );

    takes.unreadable.add('file:///recordings/broken.m4a');

    expect((await useCase.execute(new Date(2026, 9, 1)))?.voiced.map(({ entry }) => entry.id)).toEqual(['fine']);
  });

  it('has nothing to play when no entry kept a voice, or nothing can measure the takes', async () => {
    const silent = await setUp([entryOn('typed', new Date(2026, 9, 3), { source: 'text' })], []);

    expect(await silent.useCase.execute(new Date(2026, 9, 1))).toBeNull();

    const unmeasured = await setUp([entryOn('spoken', new Date(2026, 9, 3))], ['spoken']);

    unmeasured.takes.absent = true;

    expect(await unmeasured.useCase.execute(new Date(2026, 9, 1))).toBeNull();
  });
});
