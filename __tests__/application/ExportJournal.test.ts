import { ExportJournal } from '@/application/use-cases/ExportJournal';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { JournalCodec, UnreadableExportError } from '@/infrastructure/persistence/JournalCodec';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { FixedClock } from './fakes';

const NOW = new Date(2026, 8, 1, 12, 0);

function entry(id: string, createdAt: Date, extras: Partial<Parameters<typeof MoodEntry.create>[0]> = {}) {
  return MoodEntry.create({
    id,
    createdAt,
    source: 'voice',
    rawTranscript: 'raw words',
    cleanTranscript: 'Something true about the day.',
    mood: MoodScore.of(4),
    confidence: Confidence.of(0.9),
    emotionIds: ['happy.calm'],
    observation: 'A quiet day, held well.',
    ...extras,
  });
}

async function exporterOver(entries: readonly MoodEntry[]) {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return new ExportJournal(repository, new JournalCodec(), new FixedClock(NOW));
}

const FORMATTERS = {
  labelOf: (id: string) => `label:${id}`,
  dayOf: (date: Date) => date.toISOString().slice(0, 10),
  timeOf: (date: Date) => date.toISOString().slice(11, 16),
};

describe('ExportJournal', () => {
  it('round-trips every field through the backup file', async () => {
    const original = entry('one', new Date(2026, 7, 30, 9, 30));
    const exporter = await exporterOver([original]);

    const { json } = await exporter.execute(FORMATTERS);
    const [back] = new JournalCodec().decode(json);

    expect(back?.id).toBe('one');
    expect(back?.cleanTranscript).toBe(original.cleanTranscript);
    expect(back?.rawTranscript).toBe(original.rawTranscript);
    expect(back?.observation).toBe(original.observation);
    expect(back?.mood?.value).toBe(4);
    expect(back?.emotionIds).toEqual(['happy.calm']);
    expect(back?.createdAt.getTime()).toBe(original.createdAt.getTime());
  });

  it('writes the readable file oldest day first with words, labels and remark', async () => {
    const exporter = await exporterOver([
      entry('late', new Date(2026, 7, 31, 20, 0)),
      entry('early', new Date(2026, 7, 30, 9, 0)),
    ]);

    const { markdown, entryCount } = await exporter.execute(FORMATTERS);

    expect(entryCount).toBe(2);
    expect(markdown.indexOf('2026-08-30')).toBeLessThan(markdown.indexOf('2026-08-31'));
    expect(markdown).toContain('Something true about the day.');
    expect(markdown).toContain('label:happy.calm');
    expect(markdown).toContain('> A quiet day, held well.');
  });

  it('leaves the emotion line out of an entry that named none', async () => {
    const exporter = await exporterOver([
      entry('bare', new Date(2026, 7, 30, 9, 0), { emotionIds: [], observation: null }),
    ]);

    const { markdown } = await exporter.execute(FORMATTERS);

    expect(markdown).not.toContain('label:');
    expect(markdown).not.toContain('>');
  });
});

describe('JournalCodec.decode', () => {
  it('refuses a file made by another app', () => {
    expect(() => new JournalCodec().decode('{"app":"other","format":1,"entries":[]}')).toThrow(
      UnreadableExportError,
    );
  });

  it('refuses a file from a newer Vidlun rather than guessing at it', () => {
    expect(() => new JournalCodec().decode('{"app":"vidlun","format":99,"entries":[]}')).toThrow(
      UnreadableExportError,
    );
  });

  it('refuses the whole file when one entry is corrupt', () => {
    const good = new JournalCodec().encode([entryFor('ok')], NOW);
    const broken = good.replace('"cleanTranscript"', '"cleanTranscrpt"');

    expect(() => new JournalCodec().decode(broken)).toThrow();
  });
});

function entryFor(id: string): MoodEntry {
  return entry(id, new Date(2026, 7, 30, 9, 0));
}
