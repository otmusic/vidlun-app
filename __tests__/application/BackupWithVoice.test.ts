import { BackUpJournal, voiceStem } from '@/application/use-cases/BackUpJournal';
import { ImportJournal } from '@/application/use-cases/ImportJournal';
import { RestoreJournal } from '@/application/use-cases/RestoreJournal';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import type {
  BackupInput,
  IBackupArchive,
  OpenedBackup,
  PickedFile,
  WrittenBackup,
} from '@/domain/ports/IBackupArchive';
import type { IFilePicker } from '@/domain/ports/IFilePicker';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { InMemoryMoodEntryRepository } from '@/infrastructure/persistence/InMemoryMoodEntryRepository';
import { JournalCodec } from '@/infrastructure/persistence/JournalCodec';
import { FixedClock, InMemoryRecordingStore } from './fakes';

const NOW = new Date(2026, 10, 18, 12, 0);
const FILE: PickedFile = { uri: 'file:///picked/Vidlun backup.zip', name: 'Vidlun backup.zip' };

function entry(id: string, createdAt: Date, words = 'Something true about the day.'): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt,
    source: 'voice',
    rawTranscript: 'raw words',
    cleanTranscript: words,
    mood: MoodScore.of(4),
    confidence: Confidence.of(0.9),
    emotionIds: [],
  });
}

/** Keeps what it was given, places every voice but the ones told to fail, and renders the journal. */
class FakeBackupArchive implements IBackupArchive {
  carriesAudio = true;
  readonly failing = new Set<string>();
  written: BackupInput | null = null;
  markdown = '';
  opened: OpenedBackup = { json: '', recordings: [] };
  openFails = false;
  closed = 0;

  write(input: BackupInput): Promise<WrittenBackup> {
    this.written = input;

    const placed = new Map(
      input.voices
        .filter((voice) => !this.failing.has(voice.entryId))
        .map((voice) => [voice.entryId, `audio/${voice.name}`]),
    );

    input.voices.forEach((_voice, index) => {
      input.onProgress?.(index + 1, input.voices.length);
    });
    this.markdown = input.render(placed);

    return Promise.resolve({ uri: `file:///cache/${input.folderName}.zip`, recordingCount: placed.size });
  }

  readonly openedFiles: PickedFile[] = [];

  open(file: PickedFile): Promise<OpenedBackup> {
    this.openedFiles.push(file);

    return this.openFails ? Promise.reject(new Error('not a backup')) : Promise.resolve(this.opened);
  }

  close(): Promise<void> {
    this.closed += 1;

    return Promise.resolve();
  }
}

const LABELS = {
  labelOf: (id: string) => `label:${id}`,
  dayOf: (date: Date) => `day ${String(date.getDate())}`,
  timeOf: (date: Date) => `${String(date.getHours())}:${String(date.getMinutes()).padStart(2, '0')}`,
  folderName: 'Vidlun backup',
  journalName: 'Journal.md',
  voiceLabel: 'Voice',
};

/** Hands over one file, or nothing when the person closes the picker, and notes what came back. */
class FakeFilePicker implements IFilePicker {
  readonly discarded: PickedFile[] = [];

  constructor(private readonly picked: PickedFile | null) {}

  pickFile(): Promise<PickedFile | null> {
    return Promise.resolve(this.picked);
  }

  discard(file: PickedFile): Promise<void> {
    this.discarded.push(file);

    return Promise.resolve();
  }
}

async function journalOf(entries: readonly MoodEntry[]): Promise<InMemoryMoodEntryRepository> {
  const repository = new InMemoryMoodEntryRepository();

  for (const each of entries) {
    await repository.save(each);
  }

  return repository;
}

describe('backing up with the voice', () => {
  async function setup(entries: readonly MoodEntry[], voices: Record<string, string> = {}) {
    const recordings = new InMemoryRecordingStore();
    const archive = new FakeBackupArchive();

    for (const [id, uri] of Object.entries(voices)) {
      await recordings.keep(id, uri);
    }

    const subject = new BackUpJournal(
      await journalOf(entries),
      new JournalCodec(),
      recordings,
      archive,
      new FixedClock(NOW),
    );

    return { archive, subject };
  }

  // Owner's word, 2026-11-18: the backup carries the recordings by default.
  it('packs every recording still on the phone with the whole journal, oldest entry first', async () => {
    const { archive, subject } = await setup(
      [
        entry('older', new Date(2026, 10, 1, 9, 0)),
        entry('newer', new Date(2026, 10, 17, 21, 0)),
        entry('typed', new Date(2026, 10, 10, 8, 0)),
      ],
      { newer: 'file:///rec/newer.wav', older: 'file:///rec/older.wav' },
    );

    const outcome = await subject.execute(LABELS);

    expect(archive.written?.voices).toEqual([
      { entryId: 'older', name: '2026-11-01 09-00.m4a', uri: 'file:///rec/older.wav' },
      { entryId: 'newer', name: '2026-11-17 21-00.m4a', uri: 'file:///rec/newer.wav' },
    ]);
    expect(new JournalCodec().decode(archive.written?.json ?? '').map((each) => each.id)).toEqual([
      'older',
      'typed',
      'newer',
    ]);
    expect(outcome).toEqual({ uri: 'file:///cache/Vidlun backup.zip', entryCount: 3, recordingCount: 2 });
  });

  // Owner's word, 2026-11-23: the backup is also the journal to read anywhere.
  it('names each voice by when it was said and links it above the words', async () => {
    const { archive, subject } = await setup(
      [entry('one', new Date(2026, 10, 18, 21, 10), 'Evening words.')],
      { one: 'file:///recordings/one.m4a' },
    );

    await subject.execute(LABELS);

    expect(archive.markdown).toContain('**21:10**\n\n[Voice](audio/2026-11-18%2021-10.m4a)\n\nEvening words.');
  });

  it('writes no link for an entry without a voice', async () => {
    const { archive, subject } = await setup([entry('typed', new Date(2026, 10, 18, 9, 5), 'Typed words.')]);

    await subject.execute(LABELS);

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
    const outcome = await subject.execute(LABELS);

    expect(archive.markdown).toContain('audio/2026-11-17%2008-00.m4a');
    expect(archive.markdown).not.toContain('2026-11-18%2008-00');
    expect(outcome?.recordingCount).toBe(1);
  });

  it('keeps two entries of the same minute apart', async () => {
    const { archive, subject } = await setup(
      [entry('first', new Date(2026, 10, 18, 21, 10, 5)), entry('second', new Date(2026, 10, 18, 21, 10, 40))],
      { first: 'file:///recordings/first.m4a', second: 'file:///recordings/second.m4a' },
    );

    await subject.execute(LABELS);

    expect(archive.written?.voices.map((voice) => voice.name)).toEqual([
      '2026-11-18 21-10.m4a',
      '2026-11-18 21-10 (2).m4a',
    ]);
  });

  it('writes the text alone where recordings cannot travel', async () => {
    const { archive, subject } = await setup([entry('one', new Date(2026, 10, 18, 21, 10))], {
      one: 'file:///recordings/one.m4a',
    });

    archive.carriesAudio = false;
    const outcome = await subject.execute(LABELS);

    expect(archive.written?.voices).toEqual([]);
    expect(archive.markdown).not.toContain('[Voice]');
    expect(outcome?.recordingCount).toBe(0);
    expect(outcome?.entryCount).toBe(1);
  });

  it('says how far it is while the voices are packed', async () => {
    const { subject } = await setup(
      [entry('a', new Date(2026, 10, 17, 8, 0)), entry('b', new Date(2026, 10, 18, 8, 0))],
      { a: 'file:///recordings/a.m4a', b: 'file:///recordings/b.m4a' },
    );
    const seen: string[] = [];

    await subject.execute(LABELS, (done, total) => {
      seen.push(`${String(done)}/${String(total)}`);
    });

    expect(seen).toEqual(['1/2', '2/2']);
  });

  it('carries every entry, oldest day first, under the folder and file names it was given', async () => {
    const { archive, subject } = await setup([
      entry('new', new Date(2026, 10, 18, 8, 0), 'Newer.'),
      entry('old', new Date(2026, 10, 1, 8, 0), 'Older.'),
    ]);

    await subject.execute(LABELS);

    expect(archive.written?.folderName).toBe('Vidlun backup');
    expect(archive.written?.journalName).toBe('Journal.md');
    expect(archive.markdown.indexOf('Older.')).toBeLessThan(archive.markdown.indexOf('Newer.'));
  });

  it('writes nothing for an empty journal', async () => {
    const { archive, subject } = await setup([]);

    await expect(subject.execute(LABELS)).resolves.toBeNull();
    expect(archive.written).toBeNull();
  });
});

describe('voiceStem', () => {
  it('pads the date and the time on the phone clock', () => {
    expect(voiceStem(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05 07-03');
  });
});

describe('restoring with the voice', () => {
  const recent = entry('recent', new Date(2026, 10, 12, 20, 0));
  const lastYear = entry('last-year', new Date(2025, 9, 1, 20, 0));
  const alreadyHere = entry('already-here', new Date(2026, 10, 2, 20, 0));
  const json = new JournalCodec().encode([lastYear, alreadyHere, recent], NOW);

  /** Refuses to keep the recordings named, as a full disk or a broken file would. */
  class PickyRecordingStore extends InMemoryRecordingStore {
    readonly refused = new Set<string>();

    override keep(entryId: string, sourceUri: string): Promise<void> {
      return this.refused.has(entryId)
        ? Promise.reject(new Error('cannot keep'))
        : super.keep(entryId, sourceUri);
    }
  }

  async function restore(
    archive: FakeBackupArchive,
    options: {
      keepRecordings?: boolean;
      heard?: Record<string, string>;
      refused?: string[];
      picker?: FakeFilePicker;
    } = {},
  ) {
    const repository = await journalOf([alreadyHere]);
    const picker = options.picker ?? new FakeFilePicker(FILE);
    const recordings = new PickyRecordingStore();

    for (const id of options.refused ?? []) {
      recordings.refused.add(id);
    }

    for (const [id, uri] of Object.entries(options.heard ?? {})) {
      await recordings.keep(id, uri);
    }

    const useCase = new RestoreJournal(
      new ImportJournal(repository, new JournalCodec()),
      repository,
      recordings,
      archive,
      picker,
    );
    const outcome = await useCase.execute(options.keepRecordings ?? true);

    return { outcome, recordings, picker };
  }

  function archiveWith(ids: readonly string[]): FakeBackupArchive {
    const archive = new FakeBackupArchive();

    archive.opened = { json, recordings: ids.map((id) => ({ entryId: id, uri: `file:///unpacked/${id}.m4a` })) };

    return archive;
  }

  it('keeps each recording from the backup with its entry, as it came', async () => {
    const archive = archiveWith(['recent']);

    const { outcome, recordings } = await restore(archive);

    expect(outcome).toEqual({ imported: 2, skipped: 1, recordings: 1 });
    expect(recordings.kept.get('recent')).toBe('file:///unpacked/recent.m4a');
    expect(archive.openedFiles).toEqual([FILE]);
    expect(archive.closed).toBe(1);
  });

  it('brings no voice back while keeping recordings is off', async () => {
    const archive = archiveWith(['recent']);

    const { outcome, recordings } = await restore(archive, { keepRecordings: false });

    expect(outcome?.recordings).toBe(0);
    expect(recordings.kept.size).toBe(0);
    expect(archive.closed).toBe(1);
  });

  it('leaves the audio an entry already has on this phone', async () => {
    const archive = archiveWith(['already-here']);

    const { outcome, recordings } = await restore(archive, {
      heard: { 'already-here': 'file:///rec/already-here.wav' },
    });

    expect(outcome?.recordings).toBe(0);
    expect(recordings.kept.get('already-here')).toBe('file:///rec/already-here.wav');
  });

  // Owner's word, 2026-11-18: the app no longer deletes a voice on its own.
  it('brings back a voice however old its entry is', async () => {
    const archive = archiveWith(['last-year']);

    const { outcome, recordings } = await restore(archive);

    expect(outcome?.recordings).toBe(1);
    expect(recordings.kept.get('last-year')).toBe('file:///unpacked/last-year.m4a');
  });

  it('skips a recording whose entry is not in the journal', async () => {
    const archive = archiveWith(['stranger']);

    const { outcome } = await restore(archive);

    expect(outcome?.recordings).toBe(0);
  });

  it('skips a recording it cannot keep and still restores the rest', async () => {
    const archive = archiveWith(['recent', 'already-here']);

    const { outcome, recordings } = await restore(archive, { refused: ['recent'] });

    expect(outcome).toEqual({ imported: 2, skipped: 1, recordings: 1 });
    expect(recordings.kept.has('already-here')).toBe(true);
  });

  it('cleans up even when the file is not a backup', async () => {
    const archive = new FakeBackupArchive();
    archive.openFails = true;
    const picker = new FakeFilePicker(FILE);

    await expect(restore(archive, { picker })).rejects.toThrow('not a backup');
    expect(archive.closed).toBe(1);
    expect(picker.discarded).toEqual([FILE]);
  });

  // The picker's copy holds the whole journal and its voice; once read, it must not linger.
  it('gives the picked copy back once the journal is in', async () => {
    const archive = archiveWith(['recent']);

    const { picker } = await restore(archive);

    expect(picker.discarded).toEqual([FILE]);
  });

  it('gives the picked copy back when keeping a recording fails', async () => {
    const archive = archiveWith(['recent']);

    const { picker } = await restore(archive, { refused: ['recent'] });

    expect(picker.discarded).toEqual([FILE]);
  });

  it('opens nothing when the person closes the picker without choosing', async () => {
    const archive = archiveWith(['recent']);

    const { outcome, recordings, picker } = await restore(archive, { picker: new FakeFilePicker(null) });

    expect(outcome).toBeNull();
    expect(archive.openedFiles).toEqual([]);
    expect(archive.closed).toBe(0);
    expect(picker.discarded).toEqual([]);
    expect(recordings.kept.size).toBe(0);
  });
});
