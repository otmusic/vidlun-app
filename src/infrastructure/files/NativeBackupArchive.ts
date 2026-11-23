import { Directory, File, Paths } from 'expo-file-system';

import type {
  BackupInput,
  BackupRecording,
  IBackupArchive,
  OpenedBackup,
  PickedFile,
  WrittenBackup,
} from '../../domain/ports/IBackupArchive';
import { UnreadableExportError } from '../persistence/JournalCodec';
import { ENVELOPE_NAME, readEnvelope, writeEnvelope } from './backupEnvelope';

/** The native packer; see `modules/vidlun-backup`. Null where it was not built in. */
export interface BackupPacker {
  compressAudio(source: string, target: string): Promise<void>;
  zip(source: string, target: string): Promise<void>;
  unzip(source: string, target: string): Promise<void>;
  /** The Apple Archive backups of 1.10 and 1.11, still opened. */
  unpack(source: string, target: string): Promise<void>;
}

/** Where a backup is put together, where it waits for the share sheet, and where one is opened. */
export const STAGING = 'backup-staging';
export const OUT = 'backup-out';
export const OPENED = 'backup-opened';

const AUDIO = 'audio';
/** What an Apple Archive backup held: `journal.json`, and `audio/<entry id>.m4a`. */
const ARCHIVED_JOURNAL = 'journal.json';
const ARCHIVED_RECORDING = /^([A-Za-z0-9_-]+)\.m4a$/;
/** The folder a Mac adds when it packs a ZIP again; never the backup's own. */
const MAC_SHADOW = '__MACOSX';

/**
 * The backup as one ZIP (owner's word, 2026-11-23): a folder named for the
 * day it was made, holding the Markdown journal, `audio/` with every voice
 * the phone still has as AAC, and the hidden `.vidlun.json` that restores
 * it. A voice still in WAV is compressed on the way in; one that will not
 * copy is left out, and the journal is written last so it links only to
 * files that are there.
 *
 * Opening reads that ZIP wherever it has been, packed again on a Mac
 * included, and the backups of earlier versions: the Apple Archive of 1.10
 * and 1.11, and JSON before them. Everything is staged in the cache, the
 * right lifetime for files that only exist to be handed over or unpacked.
 * Where the packer is absent the backup is the JSON alone.
 */
export class NativeBackupArchive implements IBackupArchive {
  constructor(private readonly packer: BackupPacker | null) {}

  get carriesAudio(): boolean {
    return this.packer !== null;
  }

  async write(input: BackupInput): Promise<WrittenBackup> {
    const out = freshDirectory(OUT);

    if (this.packer === null) {
      const file = new File(out, `${input.folderName}.json`);

      file.write(input.json);

      return { uri: file.uri, recordingCount: 0 };
    }

    const staging = freshDirectory(STAGING);
    const folder = new Directory(staging, input.folderName);
    const audio = new Directory(folder, AUDIO);
    const placed = new Map<string, string>();

    try {
      audio.create({ intermediates: true });

      for (const [index, voice] of input.voices.entries()) {
        try {
          const target = new File(audio, voice.name);

          if (voice.uri.endsWith('.m4a')) {
            await new File(voice.uri).copy(target);
          } else {
            await this.packer.compressAudio(voice.uri, target.uri);
          }

          placed.set(voice.entryId, `${AUDIO}/${voice.name}`);
        } catch {
          // A voice that will not copy stays out, and so does its link.
        }

        input.onProgress?.(index + 1, input.voices.length);
      }

      if (placed.size === 0) {
        audio.delete();
      }

      new File(folder, input.journalName).write(input.render(placed));
      new File(folder, ENVELOPE_NAME).write(writeEnvelope(input.json, placed));

      const target = new File(out, `${input.folderName}.zip`);

      await this.packer.zip(folder.uri, target.uri);

      return { uri: target.uri, recordingCount: placed.size };
    } finally {
      staging.delete();
    }
  }

  async open(file: PickedFile): Promise<OpenedBackup> {
    const name = file.name.toLowerCase();

    if (name.endsWith('.json')) {
      return fromJson(await new File(file.uri).text());
    }

    if (this.packer === null) {
      throw new UnreadableExportError('this build cannot open a backup with recordings');
    }

    const opened = freshDirectory(OPENED);

    return name.endsWith('.aar')
      ? openArchived(this.packer, file, opened)
      : openZip(this.packer, file, opened);
  }

  close(): Promise<void> {
    const opened = new Directory(Paths.cache, OPENED);

    if (opened.exists) {
      opened.delete();
    }

    return Promise.resolve();
  }
}

/**
 * A JSON file: a backup from before 1.10, or the hidden file itself, which a
 * Mac shows and a person might pick. Neither brings recordings.
 */
function fromJson(text: string): OpenedBackup {
  return { json: readEnvelope(text)?.json ?? text, recordings: [] };
}

async function openZip(packer: BackupPacker, file: PickedFile, opened: Directory): Promise<OpenedBackup> {
  try {
    await packer.unzip(file.uri, opened.uri);
  } catch {
    throw new UnreadableExportError('the file is not a Vidlun backup');
  }

  const folder = folderWithEnvelope(opened);
  const envelope = folder === null ? null : readEnvelope(await new File(folder, ENVELOPE_NAME).text());

  if (folder === null || envelope === null) {
    throw new UnreadableExportError('the file holds no journal');
  }

  const recordings = envelope.voices.flatMap((voice) => {
    const found = new File(folder, ...voice.path.split('/'));

    return found.exists ? [{ entryId: voice.entryId, uri: found.uri }] : [];
  });

  return { json: envelope.json, recordings };
}

/**
 * Where the hidden file is: in the backup's own folder, or at the top if
 * someone packed the folder's contents rather than the folder.
 */
function folderWithEnvelope(opened: Directory): Directory | null {
  if (new File(opened, ENVELOPE_NAME).exists) {
    return opened;
  }

  const folders = opened
    .list()
    .filter((item): item is Directory => item instanceof Directory && item.name !== MAC_SHADOW);

  return folders.find((folder) => new File(folder, ENVELOPE_NAME).exists) ?? null;
}

async function openArchived(packer: BackupPacker, file: PickedFile, opened: Directory): Promise<OpenedBackup> {
  try {
    await packer.unpack(file.uri, opened.uri);
  } catch {
    throw new UnreadableExportError('the file is not a Vidlun backup');
  }

  const journal = new File(opened, ARCHIVED_JOURNAL);

  if (!journal.exists) {
    throw new UnreadableExportError('the file holds no journal');
  }

  return { json: await journal.text(), recordings: archivedRecordings(new Directory(opened, AUDIO)) };
}

/**
 * The recordings an Apple Archive backup holds, by the names it wrote.
 * Anything else in the folder is ignored rather than trusted as an entry id.
 */
function archivedRecordings(audio: Directory): readonly BackupRecording[] {
  if (!audio.exists) {
    return [];
  }

  return audio.list().flatMap((item) => {
    const match = item instanceof File ? ARCHIVED_RECORDING.exec(item.name) : null;

    return match?.[1] === undefined ? [] : [{ entryId: match[1], uri: item.uri }];
  });
}

function freshDirectory(name: string): Directory {
  const directory = new Directory(Paths.cache, name);

  if (directory.exists) {
    directory.delete();
  }

  directory.create({ intermediates: true });

  return directory;
}
