import { AttachObservation } from '@/application/use-cases/AttachObservation';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';

function saved(overrides: Partial<Parameters<typeof MoodEntry.create>[0]> = {}): MoodEntry {
  return MoodEntry.create({
    id: 'entry-1',
    createdAt: new Date(2026, 8, 30, 18, 0),
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: MoodScore.of(4),
    emotionIds: ['happy.proud'],
    selfEmotionIds: ['happy.proud'],
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

async function setup(entry: MoodEntry | null) {
  const repository = new InMemoryMoodEntryRepository();

  if (entry !== null) {
    await repository.save(entry);
  }

  return { repository, attach: new AttachObservation(repository) };
}

describe('an echo that arrives after the entry was saved', () => {
  it('is written into the saved entry', async () => {
    const { repository, attach } = await setup(saved());

    await attach.execute('entry-1', 'The good kind of tired.');

    expect((await repository.findById('entry-1'))?.observation).toBe('The good kind of tired.');
  });

  it('hands back the entry as it now stands, for a page already open on it', async () => {
    const { attach } = await setup(saved());

    const echoed = await attach.execute('entry-1', 'The good kind of tired.');

    expect(echoed?.observation).toBe('The good kind of tired.');
  });

  it('hands back nothing when nothing was written', async () => {
    const { attach } = await setup(saved({ observation: 'Said first.' }));

    expect(await attach.execute('entry-1', 'Said second.')).toBeNull();
  });

  it("keeps everything else the person saved as it was", async () => {
    const { repository, attach } = await setup(saved());

    await attach.execute('entry-1', 'The good kind of tired.');

    const entry = await repository.findById('entry-1');

    expect(entry?.emotionIds).toEqual(['happy.proud']);
    expect(entry?.selfEmotionIds).toEqual(['happy.proud']);
    expect(entry?.wasRevisedByUser).toBe(false);
  });

  it('never replaces an echo the entry already has', async () => {
    const { repository, attach } = await setup(saved({ observation: 'Said first.' }));

    await attach.execute('entry-1', 'Said second.');

    expect((await repository.findById('entry-1'))?.observation).toBe('Said first.');
  });

  it('leaves an entry whose words were changed since the echo was written', async () => {
    const { repository, attach } = await setup(saved({ wasRevisedByUser: true }));

    await attach.execute('entry-1', 'About words that are no longer there.');

    expect((await repository.findById('entry-1'))?.observation).toBeNull();
  });

  it('does nothing for an entry that was never saved or has been deleted', async () => {
    const { repository, attach } = await setup(null);

    await attach.execute('entry-1', 'Nobody to say it to.');

    expect(await repository.findById('entry-1')).toBeNull();
  });

  it('never gives a crisis entry an echo', async () => {
    const { repository, attach } = await setup(saved({ safetyFlag: 'crisis' }));

    const echoed = await attach.execute('entry-1', 'A cheerful line that must not land here.');

    expect(echoed).toBeNull();
    expect((await repository.findById('entry-1'))?.observation).toBeNull();
  });
});
