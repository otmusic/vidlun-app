import { GetMonthSummary } from '@/application/use-cases/GetMonthSummary';
import { MoodEntry, type MoodEntryProps } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import type { VoiceCue } from '@/domain/value-objects/VoiceCue';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock, StubNarrativeGenerator } from './fakes';

/** 3 September: the August piece is still fresh. */
const EARLY_SEPTEMBER = new Date(2026, 8, 3, 10, 0);

let nextId = 0;

function entryOn(date: Date, overrides: Partial<MoodEntryProps> = {}): MoodEntry {
  nextId += 1;

  return MoodEntry.create({
    id: `entry-${nextId}`,
    createdAt: date,
    source: 'voice',
    rawTranscript: 'raw',
    cleanTranscript: 'Something happened.',
    mood: MoodScore.of(3),
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

/** Every entry it is asked about sounded quieter; broken, it cannot read a voice at all. */
class QuietVoices {
  readonly asked: (readonly string[])[] = [];
  broken = false;

  ofSaved(entryIds: readonly string[]): Promise<ReadonlyMap<string, VoiceCue>> {
    this.asked.push(entryIds);

    if (this.broken) {
      return Promise.reject(new Error('the readings could not be read'));
    }

    return Promise.resolve(new Map(entryIds.map((id) => [id, { marks: ['quieter'] }])));
  }
}

async function setup(entries: readonly MoodEntry[], now = EARLY_SEPTEMBER) {
  const repository = new InMemoryMoodEntryRepository();

  for (const entry of entries) {
    await repository.save(entry);
  }

  const generator = new StubNarrativeGenerator();
  const voices = new QuietVoices();

  return { generator, voices, useCase: new GetMonthSummary(repository, generator, new FixedClock(now), voices) };
}

describe('GetMonthSummary', () => {
  it('is fresh in the first week of a month and rests after', async () => {
    const early = await setup([], new Date(2026, 8, 7, 9, 0));
    const late = await setup([], new Date(2026, 8, 8, 9, 0));

    expect(early.useCase.isFresh()).toBe(true);
    expect(late.useCase.isFresh()).toBe(false);
  });

  it('writes about the previous month and nothing else', async () => {
    const { generator, useCase } = await setup([
      entryOn(new Date(2026, 7, 5, 9, 0)),
      entryOn(new Date(2026, 7, 20, 9, 0)),
      entryOn(new Date(2026, 7, 30, 9, 0)),
      entryOn(new Date(2026, 8, 1, 9, 0)),
      entryOn(new Date(2026, 6, 30, 9, 0)),
    ]);

    const month = await useCase.execute({ withNarrative: true });

    expect(month.monthStart).toEqual(new Date(2026, 7, 1));
    expect(month.entryCount).toBe(3);
    expect(month.narrative).not.toBeNull();
    expect(generator.calls[0]).toHaveLength(3);
    // Oldest first, the way a month reads.
    expect(generator.calls[0]?.[0]?.createdAt).toEqual(new Date(2026, 7, 5, 9, 0));
  });

  it('reads the month it is given, for one opened from the list of past months', async () => {
    const { generator, useCase } = await setup([
      entryOn(new Date(2026, 5, 3, 9, 0)),
      entryOn(new Date(2026, 5, 14, 9, 0)),
      entryOn(new Date(2026, 5, 29, 9, 0)),
      entryOn(new Date(2026, 7, 5, 9, 0)),
    ]);

    const month = await useCase.execute({ withNarrative: true, month: new Date(2026, 5, 17) });

    expect(month.monthStart).toEqual(new Date(2026, 5, 1));
    expect(month.entryCount).toBe(3);
    expect(generator.calls[0]).toHaveLength(3);
  });

  it('does not pay the model for a month too thin to read', async () => {
    const { generator, useCase } = await setup([entryOn(new Date(2026, 7, 5, 9, 0))]);

    const month = await useCase.execute({ withNarrative: true });

    expect(month.hasEnough).toBe(false);
    expect(month.narrative).toBeNull();
    expect(generator.calls).toHaveLength(0);
  });

  it('hands the shape without prose when not asked for it', async () => {
    const { generator, useCase } = await setup([
      entryOn(new Date(2026, 7, 5, 9, 0)),
      entryOn(new Date(2026, 7, 6, 9, 0)),
      entryOn(new Date(2026, 7, 7, 9, 0)),
    ]);

    const month = await useCase.execute({ withNarrative: false });

    expect(month.hasEnough).toBe(true);
    expect(month.narrative).toBeNull();
    expect(generator.calls).toHaveLength(0);
  });

  it('hears how the spoken entries sounded, and leaves typed and hard ones out', async () => {
    const spoken = entryOn(new Date(2026, 7, 5, 9, 0));
    const typed = entryOn(new Date(2026, 7, 6, 9, 0), { source: 'text' });
    const hard = entryOn(new Date(2026, 7, 7, 9, 0), { safetyFlag: 'distress' });
    const { generator, voices, useCase } = await setup([spoken, typed, hard]);

    await useCase.execute({ withNarrative: true });

    expect(voices.asked).toEqual([[spoken.id]]);
    expect(generator.voices[0]).toEqual(new Map([[spoken.id, { marks: ['quieter'] }]]));
  });

  it('still writes the month when the voice cannot be read', async () => {
    const { generator, voices, useCase } = await setup([
      entryOn(new Date(2026, 7, 5, 9, 0)),
      entryOn(new Date(2026, 7, 6, 9, 0)),
      entryOn(new Date(2026, 7, 7, 9, 0)),
    ]);

    voices.broken = true;

    const month = await useCase.execute({ withNarrative: true });

    expect(month.narrative).not.toBeNull();
    expect(generator.voices[0]?.size).toBe(0);
  });

  it('does not read the voice for a month it is not writing', async () => {
    const { voices, useCase } = await setup([
      entryOn(new Date(2026, 7, 5, 9, 0)),
      entryOn(new Date(2026, 7, 6, 9, 0)),
      entryOn(new Date(2026, 7, 7, 9, 0)),
    ]);

    await useCase.execute({ withNarrative: false });

    expect(voices.asked).toHaveLength(0);
  });
});
