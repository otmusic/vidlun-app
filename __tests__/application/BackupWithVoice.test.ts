import { BackUpJournal } from '@/application/use-cases/BackUpJournal';
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
const FILE: PickedFile = { uri: 'file:///picked/vidlun-backup-2026-11-18.aar', name: 'vidlun-backup-2026-11-18.aar' };

function entry(id: string, createdAt: Date): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt,
    source: 'voice',
    rawTranscript: 'raw words',
    cleanTranscript: 'Something true about the day.',
    mood: MoodScore.of(4),
    confidence: Confidence.of(0.9),
    emotionIds: [],
  });
}

class FakeBackupArchive implements IBackupArchive {
  carriesAudio = true;
  written: BackupInput | null = null;
  opened: OpenedBackup = { json: '', recordings: [] };
  openFails = false;
  closed = 0;

  write(input: BackupInput): Promise<WrittenBackup> {
    this.written = input;
    input.onProgress?.(input.recordings.length, input.recordings.length);

    return Promise.resolve({
      uri: `file:///cache/${input.basename}.aar`,
      recordingCount: input.recordings.length,
    });
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
  const older = entry('older', new Date(2026, 10, 1, 9, 0));
  const newer = entry('newer', new Date(2026, 10, 17, 21, 0));
  const typed = entry('typed', new Date(2026, 10, 10, 8, 0));

  async function backUp(archive: FakeBackupArchive, kept: Record<string, string>) {
    const recordings = new InMemoryRecordingStore();

    for (const [id, uri] of Object.entries(kept)) {
      await recordings.keep(id, uri);
    }

    const useCase = new BackUpJournal(
      await journalOf([older, newer, typed]),
      new JournalCodec(),
      recordings,
      archive,
      new FixedClock(NOW),
    );

    return useCase.execute();
  }

  // Owner's word, 2026-11-18: the backup carries the recordings by default.
  it('packs every recording still on the phone with the journal, oldest entry first', async () => {
    const archive = new FakeBackupArchive();

    const outcome = await backUp(archive, { newer: 'file:///rec/newer.wav', older: 'file:///rec/older.wav' });

    expect(archive.written?.recordings).toEqual([
      { entryId: 'older', uri: 'file:///rec/older.wav' },
      { entryId: 'newer', uri: 'file:///rec/newer.wav' },
    ]);
    expect(new JournalCodec().decode(archive.written?.json ?? '').map((each) => each.id)).toEqual([
      'older',
      'typed',
      'newer',
    ]);
    expect(archive.written?.basename).toBe('vidlun-backup-2026-11-18');
    expect(outcome).toEqual({
      uri: 'file:///cache/vidlun-backup-2026-11-18.aar',
      entryCount: 3,
      recordingCount: 2,
    });
  });

  it('writes the text alone where recordings cannot travel', async () => {
    const archive = new FakeBackupArchive();
    archive.carriesAudio = false;

    const outcome = await backUp(archive, { newer: 'file:///rec/newer.wav' });

    expect(archive.written?.recordings).toEqual([]);
    expect(outcome?.recordingCount).toBe(0);
    expect(outcome?.entryCount).toBe(3);
  });

  it('writes nothing for an empty journal', async () => {
    const archive = new FakeBackupArchive();
    const useCase = new BackUpJournal(
      new InMemoryMoodEntryRepository(),
      new JournalCodec(),
      new InMemoryRecordingStore(),
      archive,
      new FixedClock(NOW),
    );

    expect(await useCase.execute()).toBeNull();
    expect(archive.written).toBeNull();
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
