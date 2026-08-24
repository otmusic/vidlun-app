import { Directory, File, Paths, type DownloadProgress } from 'expo-file-system';

import type { ModelStorage } from './SpeechModelStore';

/**
 * Half a gigabyte of weights, kept where the system will not reclaim it.
 *
 * The cache directory is the wrong home: iOS empties it under storage
 * pressure, and a model that vanishes between sessions would send the user
 * back through the download they already sat through once.
 */
const MODEL_DIRECTORY = 'speech-model';

export class ExpoModelStorage implements ModelStorage {
  private readonly directory = new Directory(Paths.document, MODEL_DIRECTORY);

  async sizeOf(name: string): Promise<number | null> {
    const file = this.fileFor(name);

    return Promise.resolve(file.exists ? (file.size ?? null) : null);
  }

  async download(
    url: string,
    name: string,
    onProgress: (writtenBytes: number, totalBytes: number | null) => void,
  ): Promise<void> {
    this.ensureDirectory();

    const task = File.createDownloadTask(url, this.fileFor(name), {
      onProgress: (progress: DownloadProgress) => {
        // The header is optional, and -1 is how its absence arrives. Passing
        // that on as a total would render as a progress bar running backwards.
        onProgress(progress.bytesWritten, progress.totalBytes > 0 ? progress.totalBytes : null);
      },
    });

    // sessionType defaults to 'background' on iOS, so half a gigabyte keeps
    // arriving while the user reads the rest of onboarding.
    await task.downloadAsync();
  }

  async rename(from: string, to: string): Promise<void> {
    await this.fileFor(from).move(this.fileFor(to));
  }

  async remove(name: string): Promise<void> {
    const file = this.fileFor(name);

    if (file.exists) {
      file.delete();
    }

    return Promise.resolve();
  }

  uriFor(name: string): string {
    return this.fileFor(name).uri;
  }

  private fileFor(name: string): File {
    return new File(this.directory, name);
  }

  private ensureDirectory(): void {
    if (!this.directory.exists) {
      this.directory.create({ intermediates: true });
    }
  }
}
