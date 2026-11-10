import { AskForReview } from '@/application/use-cases/AskForReview';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import type { IReviewAsks } from '@/domain/ports/IReviewAsks';
import type { IReviewPrompt } from '@/domain/ports/IReviewPrompt';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';

class CountingPrompt implements IReviewPrompt {
  requests = 0;

  request(): Promise<void> {
    this.requests += 1;

    return Promise.resolve();
  }
}

class RememberedAsks implements IReviewAsks {
  version: string | null = null;

  askedIn(): Promise<string | null> {
    return Promise.resolve(this.version);
  }

  remember(version: string): Promise<void> {
    this.version = version;

    return Promise.resolve();
  }
}

let minute = 0;

function entry(mood: number | null, safetyFlag: 'none' | 'distress' = 'none'): MoodEntry {
  minute += 1;

  return MoodEntry.create({
    id: `entry-${minute}`,
    createdAt: new Date(2026, 10, 5, 9, minute),
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'A good day.',
    mood: mood === null ? null : MoodScore.of(mood),
    confidence: Confidence.of(0.9),
    safetyFlag,
  });
}

async function setUp(moods: readonly MoodEntry[], version = '1.9') {
  const repository = new InMemoryMoodEntryRepository();

  for (const saved of moods) {
    await repository.save(saved);
  }

  const asks = new RememberedAsks();
  const prompt = new CountingPrompt();

  return { asks, prompt, subject: new AskForReview(repository, asks, prompt, version) };
}

describe('asking for a rating', () => {
  it('is due after the third good entry in a row', async () => {
    const { subject } = await setUp([entry(2), entry(4), entry(5), entry(4)]);

    expect(await subject.isDue()).toBe(true);
  });

  it('is not due when one of the last three was a so-so day', async () => {
    const { subject } = await setUp([entry(4), entry(3), entry(5)]);

    expect(await subject.isDue()).toBe(false);
  });

  it('is not due before there are three entries', async () => {
    const { subject } = await setUp([entry(5), entry(5)]);

    expect(await subject.isDue()).toBe(false);
  });

  it('does not count an entry that never said how the day was', async () => {
    const { subject } = await setUp([entry(4), entry(null), entry(5)]);

    expect(await subject.isDue()).toBe(false);
  });

  it('does not count a hard entry, whatever mood it was given', async () => {
    const { subject } = await setUp([entry(4), entry(4, 'distress'), entry(5)]);

    expect(await subject.isDue()).toBe(false);
  });

  it('asks the store and remembers the version it asked in', async () => {
    const { asks, prompt, subject } = await setUp([entry(4), entry(4), entry(4)]);

    await subject.ask();

    expect(prompt.requests).toBe(1);
    expect(asks.version).toBe('1.9');
  });

  it('asks once per version', async () => {
    const { subject } = await setUp([entry(4), entry(4), entry(4)]);

    await subject.ask();

    expect(await subject.isDue()).toBe(false);
  });

  it('may ask again once a new version is installed', async () => {
    const { asks, subject } = await setUp([entry(4), entry(4), entry(4)], '2.0');

    asks.version = '1.9';

    expect(await subject.isDue()).toBe(true);
  });
});
