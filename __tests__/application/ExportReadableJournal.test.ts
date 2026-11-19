import { ExportReadableJournal, voiceStem } from '@/application/use-cases/ExportReadableJournal';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import type {
  IReadableArchive,
  ReadableInput,
  WrittenReadable,
} from '@/domain/ports/IReadableArchive';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { InMemoryRecordingStore } from './fakes';

function entry(id: string, createdAt: Date, words = 'Something true about the day.'): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt,
    source: 'voice',
    rawTranscript: 'raw words',
    cleanTranscript: words,
    mood: MoodScore.of(4),
    confidence: Confidence.of(0.9),
    emotionIds: ['happy.calm'],
  });
}

/** Keeps what it was given, and copies every voice but the ones told to fail. */
class FakeReadableArchive implements IReadableArchive {
  carriesAudio = true;
  readonly failing = new Set<string>();
  written: ReadableInput | null = null;
  markdown = '';

  write(input: ReadableInput): Promise<WrittenReadable> {
    this.written = input;

    const kept = new Set(
      input.voices.filter((voice) => !this.failing.has(voice.entryId)).map((voice) => voice.entryId),
    );

    input.voices.forEach((_voice, index) => {
      input.onProgress?.(index + 1, input.voices.length);
    });
    this.markdown = input.render(kept);

    return Promise.resolve({ uri: `file:///cache/${input.folderName}.zip`, voiceCount: kept.size });
  }
}

const INPUT = {
  labelOf: (id: string) => `label:${id}`,
  dayOf: (date: Date) => `day ${String(date.getDate())}`,
  timeOf: (date: Date) => `${String(date.getHours())}:${String(date.getMinutes()).padStart(2, '0')}`,
  folderName: 'Vidlun export',
  journalName: 'Journal.md',
  voiceLabel: 'Voice',
};

async function setup(entries: readonly MoodEntry[], voices: Record<string, string> = {}) {
  const repository = new InMemoryMoodEntryRepository();
  const recordings = new InMemoryRecordingStore();
  const archive = new FakeReadableArchive();

  for (const each of entries) {
    await repository.save(each);
  }

  for (const [id, uri] of Object.entries(voices)) {
    await recordings.keep(id, uri);
  }

  return { archive, subject: new ExportReadableJournal(repository, recordings, archive) };
}

describe('ExportReadableJournal', () => {
  it('names each voice by when it was said and links it above the words', async () => {
    const { archive, subject } = await setup(
      [entry('one', new Date(2026, 10, 18, 21, 10), 'Evening words.')],
      { one: 'file:///recordings/one.m4a' },
    );

    const outcome = await subject.execute(INPUT);

    expect(archive.written?.voices).toEqual([
      { entryId: 'one', name: '2026-11-18 21-10.m4a', uri: 'file:///recordings/one.m4a' },
    ]);
    expect(archive.markdown).toContain('**21:10**\n\n[Voice](audio/2026-11-18%2021-10.m4a)\n\nEvening words.');
    expect(outcome).toEqual({ uri: 'file:///cache/Vidlun export.zip', entryCount: 1, voiceCount: 1 });
  });

  it('writes no link for an entry without a voice', async () => {
    const { archive, subject } = await setup([entry('typed', new Date(2026, 10, 18, 9, 5), 'Typed words.')]);

    await subject.execute(INPUT);

    expect(archive.written?.voices).toEqual([]);
    expect(archive.markdown).toContain('**9:05**\n\nTyped words.');
    expect(archive.markdown).not.toContain('[Voice]');
  });

  it('links only the voices that made it into the file', async () => {
    const { archive, subject } = await setup(
      [entry('kept', new Date(2026, 10, 17, 8, 0)), entry('lost', new Date(2026, 10, 18, 8, 0))],
      { kept: 'file:///recordings/kept.m4a', lost: 'file:///recordings/lost.m4a' },
    );

    archive.failing.add('lost');
    const outcome = await subject.execute(INPUT);

    expect(archive.markdown).toContain('audio/2026-11-17%2008-00.m4a');
    expect(archive.markdown).not.toContain('2026-11-18%2008-00');
    expect(outcome?.voiceCount).toBe(1);
  });

  it('keeps two entries of the same minute apart', async () => {
    const { archive, subject } = await setup(
      [entry('first', new Date(2026, 10, 18, 21, 10, 5)), entry('second', new Date(2026, 10, 18, 21, 10, 40))],
      { first: 'file:///recordings/first.m4a', second: 'file:///recordings/second.m4a' },
    );

    await subject.execute(INPUT);

    expect(archive.written?.voices.map((voice) => voice.name)).toEqual([
      '2026-11-18 21-10.m4a',
      '2026-11-18 21-10 (2).m4a',
    ]);
  });

  it('is the text alone where the voice cannot travel', async () => {
    const { archive, subject } = await setup([entry('one', new Date(2026, 10, 18, 21, 10))], {
      one: 'file:///recordings/one.m4a',
    });

    archive.carriesAudio = false;
    await subject.execute(INPUT);

    expect(archive.written?.voices).toEqual([]);
    expect(archive.markdown).not.toContain('[Voice]');
  });

  it('says how far it is while the voices are copied', async () => {
    const { subject } = await setup(
      [entry('a', new Date(2026, 10, 17, 8, 0)), entry('b', new Date(2026, 10, 18, 8, 0))],
      { a: 'file:///recordings/a.m4a', b: 'file:///recordings/b.m4a' },
    );
    const seen: string[] = [];

    await subject.execute(INPUT, (done, total) => {
      seen.push(`${String(done)}/${String(total)}`);
    });

    expect(seen).toEqual(['1/2', '2/2']);
  });

  it('carries every entry, oldest day first, with the folder and file names it was given', async () => {
    const { archive, subject } = await setup([
      entry('new', new Date(2026, 10, 18, 8, 0), 'Newer.'),
      entry('old', new Date(2026, 10, 1, 8, 0), 'Older.'),
    ]);

    await subject.execute(INPUT);

    expect(archive.written?.folderName).toBe('Vidlun export');
    expect(archive.written?.journalName).toBe('Journal.md');
    expect(archive.markdown.indexOf('Older.')).toBeLessThan(archive.markdown.indexOf('Newer.'));
  });

  it('exports nothing from an empty journal', async () => {
    const { archive, subject } = await setup([]);

    await expect(subject.execute(INPUT)).resolves.toBeNull();
    expect(archive.written).toBeNull();
  });
});

describe('voiceStem', () => {
  it('pads the date and the time on the phone clock', () => {
    expect(voiceStem(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05 07-03');
  });
});
