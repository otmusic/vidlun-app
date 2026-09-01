import { ExportJournal } from '@/application/use-cases/ExportJournal';
import { ImportJournal } from '@/application/use-cases/ImportJournal';
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

describe('ImportJournal', () => {
  it('merges only what the journal has never seen, and says so', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const codec = new JournalCodec();

    await repository.save(entryFor('kept'));

    const file = codec.encode([entryFor('kept'), entryFor('new')], NOW);
    const outcome = await new ImportJournal(repository, codec).execute(file);

    expect(outcome).toEqual({ imported: 1, skipped: 1 });
    expect((await repository.findAll()).map((entry) => entry.id).sort()).toEqual(['kept', 'new']);
  });

  it('imports nothing twice: the second run of the same file is a no-op', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const codec = new JournalCodec();
    const file = codec.encode([entryFor('one')], NOW);
    const importer = new ImportJournal(repository, codec);

    await importer.execute(file);
    const second = await importer.execute(file);

    expect(second).toEqual({ imported: 0, skipped: 1 });
    expect((await repository.findAll())).toHaveLength(1);
  });

  it('saves nothing at all from a file with one corrupt entry', async () => {
    const repository = new InMemoryMoodEntryRepository();
    const codec = new JournalCodec();
    const broken = codec
      .encode([entryFor('good'), entryFor('bad')], NOW)
      .replace('"cleanTranscript": "Something true about the day."', '"cleanTranscript": 5');

    await expect(new ImportJournal(repository, codec).execute(broken)).rejects.toThrow();
    expect(await repository.findAll()).toHaveLength(0);
  });
});
