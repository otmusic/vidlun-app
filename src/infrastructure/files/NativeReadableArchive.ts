import { Directory, File, Paths } from 'expo-file-system';

import type {
  IReadableArchive,
  ReadableInput,
  WrittenReadable,
} from '../../domain/ports/IReadableArchive';

/** The native half; see `modules/vidlun-backup`. Null where it was not built in. */
export interface ReadablePacker {
  compressAudio(source: string, target: string): Promise<void>;
  zip(source: string, target: string): Promise<void>;
}

/** Where the export is put together, and where the finished file waits for the share sheet. */
export const READABLE_STAGING = 'readable-staging';
export const READABLE_OUT = 'readable-export';

const AUDIO = 'audio';

/**
 * The readable export as one ZIP (owner's word, 2026-11-19): a folder named
 * for the day it was made, holding the Markdown journal and `audio/` with
 * every voice the phone still has, each as AAC. A voice still in WAV is
 * compressed on the way in; one that will not copy is left out, and the
 * journal is written last so it links only to files that are there.
 *
 * The finished file keeps the person's own name for it and waits in a cache
 * folder of its own, which the share sheet empties and a later launch sweeps.
 * Where the packer is absent the export is the Markdown file alone.
 */
export class NativeReadableArchive implements IReadableArchive {
  constructor(private readonly packer: ReadablePacker | null) {}

  get carriesAudio(): boolean {
    return this.packer !== null;
  }

  async write(input: ReadableInput): Promise<WrittenReadable> {
    const out = freshDirectory(READABLE_OUT);

    if (this.packer === null) {
      const file = new File(out, `${input.folderName}.md`);

      file.write(input.render(new Set()));

      return { uri: file.uri, voiceCount: 0 };
    }

    const staging = freshDirectory(READABLE_STAGING);
    const folder = new Directory(staging, input.folderName);
    const audio = new Directory(folder, AUDIO);
    const kept = new Set<string>();

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

          kept.add(voice.entryId);
        } catch {
          // A voice that will not copy stays out, and so does its link.
        }

        input.onProgress?.(index + 1, input.voices.length);
      }

      if (kept.size === 0) {
        audio.delete();
      }

      new File(folder, input.journalName).write(input.render(kept));

      const target = new File(out, `${input.folderName}.zip`);

      await this.packer.zip(folder.uri, target.uri);

      return { uri: target.uri, voiceCount: kept.size };
    } finally {
      staging.delete();
    }
  }
}

function freshDirectory(name: string): Directory {
  const directory = new Directory(Paths.cache, name);

  if (directory.exists) {
    directory.delete();
  }

  directory.create({ intermediates: true });

  return directory;
}
