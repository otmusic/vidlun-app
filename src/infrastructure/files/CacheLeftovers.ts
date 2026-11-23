import { Directory, File, Paths } from 'expo-file-system';

import type { ILeftoverFiles } from '../../domain/ports/ILeftoverFiles';
import { OPENED, OUT, STAGING } from './NativeBackupArchive';
import { HELD_VOICES } from '../persistence/FileRecordingStore';
import { MONTH_VOICE } from '../voice/NativeVoiceMontage';

/**
 * Where expo-document-picker puts its copies, the three folders a backup
 * passes through (put together, waiting for the share sheet, opened), the
 * two the readable export used before it became the backup (1.12 builds on
 * TestFlight), the voices held while a deletion could still be undone, and
 * a month joined into one file to be heard in its own voice.
 */
const FOLDERS: ReadonlySet<string> = new Set([
  'DocumentPicker',
  STAGING,
  OUT,
  OPENED,
  'readable-staging',
  'readable-export',
  HELD_VOICES,
  MONTH_VOICE,
]);

/**
 * A backup or Markdown export an earlier version wrote straight into the
 * cache for the share sheet: JSON before 1.10, an Apple Archive in 1.10 and
 * 1.11. The backup waits in its own folder now, swept whole.
 */
const HANDED_OVER = /^vidlun-(backup|journal)-\d{4}-\d{2}-\d{2}\.(aar|json|md)$/;

/**
 * Where expo-audio records. Every take of one launch goes into one file
 * there, and a kept take is moved out, so what an earlier launch left is a
 * take nobody kept. The folder itself stays: the recorder made it at launch
 * and will not make it again.
 */
const RECORDER = 'ExpoAudio';
const TAKE = /^recording-[0-9A-Fa-f-]+\.[A-Za-z0-9]+$/;

/**
 * Sweeps the app's cache for the files only Vidlun makes there, by their
 * exact names; whatever else lives in the cache is left alone. Run before
 * the first take of a launch, which is why the recorder's folder is safe to
 * empty: this launch's file does not exist until then.
 */
export class CacheLeftovers implements ILeftoverFiles {
  sweep(): Promise<void> {
    for (const item of leftovers()) {
      try {
        item.delete();
      } catch {
        // One that will not go is left to iOS; the rest still go.
      }
    }

    return Promise.resolve();
  }
}

function leftovers(): readonly (Directory | File)[] {
  const top = listed(Paths.cache);
  const takes = top
    .filter((item): item is Directory => item instanceof Directory && item.name === RECORDER)
    .flatMap((folder) => listed(folder).filter((item) => item instanceof File && TAKE.test(item.name)));

  return [...top.filter(isLeftover), ...takes];
}

function isLeftover(item: Directory | File): boolean {
  return item instanceof Directory ? FOLDERS.has(item.name) : HANDED_OVER.test(item.name);
}

/** A folder that cannot be read holds nothing to sweep; the app opens regardless. */
function listed(directory: Directory): readonly (Directory | File)[] {
  try {
    return directory.list();
  } catch {
    return [];
  }
}
