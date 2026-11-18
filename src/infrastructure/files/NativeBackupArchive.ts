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

/** The native packer; see `modules/vidlun-backup`. Null where it was not built in. */
export interface BackupPacker {
  compressAudio(source: string, target: string): Promise<void>;
  pack(source: string, target: string): Promise<void>;
  unpack(source: string, target: string): Promise<void>;
}

const JOURNAL = 'journal.json';
const AUDIO = 'audio';
const STAGING = 'backup-staging';
const OPENED = 'backup-opened';
const RECORDING = /^([A-Za-z0-9_-]+)\.m4a$/;

/**
 * The backup as one Apple Archive (owner's word, 2026-11-18): `journal.json`,
 * the codec's export as before, and `audio/<entry id>.m4a` for each kept
 * recording. Recordings are kept as AAC on the phone too, so they travel as
 * they are; one still in WAV is compressed on the way in. Restoring puts the
 * AAC files straight back, with the dates the archive carried.
 *
 * Everything is staged in the cache, the right lifetime for files that only
 * exist to be handed over or unpacked. Where the packer is absent the backup
 * is the JSON alone, and a JSON backup made before this still opens.
 */
export class NativeBackupArchive implements IBackupArchive {
  constructor(private readonly packer: BackupPacker | null) {}

  get carriesAudio(): boolean {
    return this.packer !== null;
  }

  async write(input: BackupInput): Promise<WrittenBackup> {
    if (this.packer === null) {
      const file = freshFile(`${input.basename}.json`);

      file.write(input.json);

      return { uri: file.uri, recordingCount: 0 };
    }

    const staging = freshDirectory(STAGING);
    const audio = new Directory(staging, AUDIO);
    let packed = 0;

    try {
      new File(staging, JOURNAL).write(input.json);
      audio.create();

      for (const [index, recording] of input.recordings.entries()) {
        try {
          const target = new File(audio, `${recording.entryId}.m4a`);

          if (recording.uri.endsWith('.m4a')) {
            await new File(recording.uri).copy(target);
          } else {
            await this.packer.compressAudio(recording.uri, target.uri);
          }

          packed += 1;
        } catch {
          // A recording that will not convert stays out; the entry still travels.
        }

        input.onProgress?.(index + 1, input.recordings.length);
      }

      const target = freshFile(`${input.basename}.aar`);

      await this.packer.pack(staging.uri, target.uri);

      return { uri: target.uri, recordingCount: packed };
    } finally {
      staging.delete();
    }
  }

  async open(file: PickedFile): Promise<OpenedBackup> {
    if (file.name.toLowerCase().endsWith('.json')) {
      return { json: await new File(file.uri).text(), recordings: [] };
    }

    if (this.packer === null) {
      throw new UnreadableExportError('this build cannot open a backup with recordings');
    }

    const opened = freshDirectory(OPENED);

    try {
      await this.packer.unpack(file.uri, opened.uri);
    } catch {
      throw new UnreadableExportError('the file is not a Vidlun backup');
    }

    const journal = new File(opened, JOURNAL);

    if (!journal.exists) {
      throw new UnreadableExportError('the file holds no journal');
    }

    return { json: await journal.text(), recordings: recordingsIn(new Directory(opened, AUDIO)) };
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
 * The recordings an unpacked backup holds, by the names this app writes.
 * Anything else in the folder is ignored rather than trusted as an entry id.
 */
function recordingsIn(audio: Directory): readonly BackupRecording[] {
  if (!audio.exists) {
    return [];
  }

  return audio.list().flatMap((item) => {
    const match = item instanceof File ? RECORDING.exec(item.name) : null;

    return match?.[1] === undefined ? [] : [{ entryId: match[1], uri: item.uri }];
  });
}

function freshFile(name: string): File {
  const file = new File(Paths.cache, name);

  if (file.exists) {
    file.delete();
  }

  return file;
}

function freshDirectory(name: string): Directory {
  const directory = new Directory(Paths.cache, name);

  if (directory.exists) {
    directory.delete();
  }

  directory.create({ intermediates: true });

  return directory;
}
