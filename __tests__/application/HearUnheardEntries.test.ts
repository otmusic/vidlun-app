import { HearUnheardEntries } from '@/application/use-cases/HearUnheardEntries';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import type { IReflectionAnalyzer, ReflectionProposal } from '@/domain/ports/IReflectionAnalyzer';
import type { IUnheardEntries } from '@/domain/ports/IUnheardEntries';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { createEmotionVocabulary } from '@/infrastructure/analysis/emotionVocabularyData';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';

import { proposal, StubReflectionAnalyzer } from './fakes';

const vocabulary = createEmotionVocabulary();

class InMemoryUnheard implements IUnheardEntries {
  private list: string[] = [];

  constructor(ids: readonly string[] = []) {
    this.list = [...ids];
  }

  add(entryId: string): Promise<void> {
    this.list.push(entryId);

    return Promise.resolve();
  }

  ids(): Promise<readonly string[]> {
    return Promise.resolve([...this.list]);
  }

  remove(entryId: string): Promise<void> {
    this.list = this.list.filter((id) => id !== entryId);

    return Promise.resolve();
  }
}

/** The analyzer with the network gone: every call fails. */
class DeafAnalyzer implements IReflectionAnalyzer {
  analyze(): Promise<ReflectionProposal> {
    return Promise.reject(new Error('Connection error.'));
  }
}

/** Fails once, then answers — the network coming back between two runs. */
class FlakyAnalyzer implements IReflectionAnalyzer {
  private failed = false;

  constructor(private readonly answer: ReflectionProposal) {}

  analyze(): Promise<ReflectionProposal> {
    if (!this.failed) {
      this.failed = true;

      return Promise.reject(new Error('Connection error.'));
    }

    return Promise.resolve(this.answer);
  }
}

function unheardEntry(id: string, overrides: Partial<Parameters<typeof MoodEntry.create>[0]> = {}): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date('2026-09-09T18:00:00Z'),
    source: 'voice',
    rawTranscript: 'finished three tasks happy but very tired',
    cleanTranscript: 'finished three tasks happy but very tired',
    mood: null,
    emotionIds: [],
    proposedEmotionIds: [],
    contextTags: [],
    confidence: Confidence.of(0.9),
    ...overrides,
  });
}

const heard = proposal({
  cleanTranscript: 'Finished three tasks, happy, but very tired.',
  mood: 4,
  emotionIds: ['happy.proud', 'bad.tired'],
  contextTags: ['work'],
});

describe('hearing the entries Vidlun could not listen to', () => {
  it('fills in what the person left blank and keeps the answer as the proposal', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const unheard = new InMemoryUnheard(['e1']);

    await repository.save(unheardEntry('e1'));

    const count = await new HearUnheardEntries(
      unheard,
      repository,
      new StubReflectionAnalyzer(heard),
      vocabulary,
    ).execute();
    const entry = await repository.findById('e1');

    expect(count).toBe(1);
    expect(entry?.emotionIds).toEqual(['happy.proud', 'bad.tired']);
    expect(entry?.proposedEmotionIds).toEqual(['happy.proud', 'bad.tired']);
    expect(entry?.selfEmotionIds).toEqual([]);
    expect(entry?.mood?.value).toBe(4);
    expect(entry?.contextTags).toEqual(['work']);
    expect(entry?.cleanTranscript).toBe('Finished three tasks, happy, but very tired.');
    expect(await unheard.ids()).toEqual([]);
  });

  it('never overwrites what the person named themselves', async () => {
    const repository = new InMemoryMoodEntryRepository();

    await repository.save(
      unheardEntry('e1', { selfEmotionIds: ['happy.peaceful'], emotionIds: ['happy.peaceful'] }),
    );

    await new HearUnheardEntries(
      new InMemoryUnheard(['e1']),
      repository,
      new StubReflectionAnalyzer(heard),
      vocabulary,
    ).execute();
    const entry = await repository.findById('e1');

    expect(entry?.emotionIds).toEqual(['happy.peaceful']);
    expect(entry?.selfEmotionIds).toEqual(['happy.peaceful']);
    // Vidlun's late answer still stands beside theirs, as it would have on the card.
    expect(entry?.proposedEmotionIds).toEqual(['happy.proud', 'bad.tired']);
    expect(entry?.mood?.value).toBe(4);
  });

  it('keeps a transcript the person corrected, and a mood they set', async () => {
    const repository = new InMemoryMoodEntryRepository();

    await repository.save(
      unheardEntry('e1', {
        cleanTranscript: 'Finished three tasks. Happy, but very tired.',
        mood: MoodScore.of(2),
        wasRevisedByUser: true,
      }),
    );

    await new HearUnheardEntries(
      new InMemoryUnheard(['e1']),
      repository,
      new StubReflectionAnalyzer(heard),
      vocabulary,
    ).execute();
    const entry = await repository.findById('e1');

    expect(entry?.cleanTranscript).toBe('Finished three tasks. Happy, but very tired.');
    expect(entry?.mood?.value).toBe(2);
    expect(entry?.wasRevisedByUser).toBe(true);
    // A revised entry keeps its words even when none were chosen.
    expect(entry?.emotionIds).toEqual([]);
    expect(entry?.proposedEmotionIds).toEqual(['happy.proud', 'bad.tired']);
  });

  it('stops at the first entry the network will not carry and keeps the rest waiting', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const unheard = new InMemoryUnheard(['e1', 'e2']);

    await repository.save(unheardEntry('e1'));
    await repository.save(unheardEntry('e2'));

    const count = await new HearUnheardEntries(unheard, repository, new DeafAnalyzer(), vocabulary).execute();

    expect(count).toBe(0);
    expect(await unheard.ids()).toEqual(['e1', 'e2']);
    expect((await repository.findById('e1'))?.emotionIds).toEqual([]);
  });

  it('hears the rest on a later run, once the network is back', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const unheard = new InMemoryUnheard(['e1']);
    const hearing = new HearUnheardEntries(unheard, repository, new FlakyAnalyzer(heard), vocabulary);

    await repository.save(unheardEntry('e1'));

    expect(await hearing.execute()).toBe(0);
    expect(await hearing.execute()).toBe(1);
    expect(await unheard.ids()).toEqual([]);
  });

  it('forgets an entry that was deleted in the meantime', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const unheard = new InMemoryUnheard(['gone', 'e1']);
    const analyzer = new StubReflectionAnalyzer(heard);

    await repository.save(unheardEntry('e1'));

    const count = await new HearUnheardEntries(unheard, repository, analyzer, vocabulary).execute();

    expect(count).toBe(1);
    expect(analyzer.received).toEqual(['finished three tasks happy but very tired']);
    expect(await unheard.ids()).toEqual([]);
  });

  it('runs once at a time: a second call joins the first', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const unheard = new InMemoryUnheard(['e1']);
    const analyzer = new StubReflectionAnalyzer(heard);
    const hearing = new HearUnheardEntries(unheard, repository, analyzer, vocabulary);

    await repository.save(unheardEntry('e1'));

    const [first, second] = await Promise.all([hearing.execute(), hearing.execute()]);

    expect(first + second).toBe(2);
    expect(analyzer.received).toHaveLength(1);
  });
});
