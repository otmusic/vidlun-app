import { CachedNarrativeGenerator } from '@/infrastructure/analysis/CachedNarrativeGenerator';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import type { INarrativeGenerator } from '@/domain/ports/INarrativeGenerator';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryKeyValueStore } from './fakes';

class CountingGenerator implements INarrativeGenerator {
  calls = 0;

  constructor(private readonly narrative = 'Calmer mornings, tense evenings.') {}

  generate(): Promise<string> {
    this.calls += 1;

    return Promise.resolve(`${this.narrative} #${this.calls}`);
  }
}

function entry(id: string, overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(2026, 7, 25, 20, 0),
    source: 'voice',
    rawTranscript: 'anything',
    cleanTranscript: 'Anything.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

function setup() {
  const inner = new CountingGenerator();
  const store = new InMemoryKeyValueStore();

  return { inner, store, subject: new CachedNarrativeGenerator(inner, store) };
}

describe('the month is written once', () => {
  it('reads the same month back rather than paying for it twice', async () => {
    const { inner, subject } = setup();
    const month = [entry('a'), entry('b')];

    const first = await subject.generate(month);

    expect(await subject.generate(month)).toBe(first);
    expect(inner.calls).toBe(1);
  });

  it('writes again when the month gained an entry', async () => {
    const { inner, subject } = setup();

    await subject.generate([entry('a')]);
    await subject.generate([entry('a'), entry('b')]);

    expect(inner.calls).toBe(2);
  });

  it('writes again when an entry was corrected', async () => {
    const { inner, subject } = setup();

    await subject.generate([entry('a', { emotionIds: ['bad.tired'] })]);
    await subject.generate([entry('a', { emotionIds: ['happy'] })]);

    // A sentence about a month that has since changed is worse than a new one.
    expect(inner.calls).toBe(2);
  });

  it('keeps one row per month rather than one per version of it', async () => {
    const { store, subject } = setup();

    await subject.generate([entry('a')]);
    await subject.generate([entry('a'), entry('b')]);

    const keys = await store.getAllKeys();

    expect(keys.filter((key) => key.startsWith('vidlun.narrative.'))).toHaveLength(1);
  });

  it('files two different months apart', async () => {
    const { store, subject } = setup();

    await subject.generate([entry('a')]);
    await subject.generate([entry('c', { createdAt: new Date(2026, 6, 18, 20, 0) })]);

    expect(await store.getAllKeys()).toHaveLength(2);
  });

  it('still answers when the cache cannot be read', async () => {
    const { store, subject } = setup();

    store.poison('vidlun.narrative.month.2026-8', 'not json');

    await expect(subject.generate([entry('a')])).resolves.toContain('Calmer mornings');
  });
});
