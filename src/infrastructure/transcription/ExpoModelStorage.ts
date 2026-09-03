import {
  Directory,
  DownloadTask,
  File,
  Paths,
  type DownloadPauseState,
  type DownloadProgress,
} from 'expo-file-system';

import type { ModelDownload, ModelStorage, Progress } from './SpeechModelStore';

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

  startDownload(url: string, name: string, onProgress: Progress): ModelDownload {
    this.ensureDirectory();

    const task = File.createDownloadTask(url, this.fileFor(name), {
      onProgress: progressBridge(onProgress),
    });

    return track(task, task.downloadAsync());
  }

  resumeDownload(saved: string, onProgress: Progress): ModelDownload {
    this.ensureDirectory();

    /*
     * The platform's own resume state, kept verbatim since the pause. It
     * carries the temp file and the server's validators; if either no longer
     * holds, resuming rejects and the store starts over.
     */
    const task = DownloadTask.fromSavable(JSON.parse(saved) as DownloadPauseState, {
      onProgress: progressBridge(onProgress),
    });

    return track(task, task.resumeAsync());
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

  async writeNote(name: string, text: string): Promise<void> {
    this.ensureDirectory();
    this.fileFor(name).write(text);

    return Promise.resolve();
  }

  async readNote(name: string): Promise<string | null> {
    const file = this.fileFor(name);

    return file.exists ? file.text() : Promise.resolve(null);
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

function progressBridge(onProgress: Progress): (progress: DownloadProgress) => void {
  return (progress) => {
    // The header is optional, and -1 is how its absence arrives. Passing
    // that on as a total would render as a progress bar running backwards.
    onProgress(progress.bytesWritten, progress.totalBytes > 0 ? progress.totalBytes : null);
  };
}

/**
 * Wraps a task so the store sees only an outcome and a pause. The task's
 * promise resolves with the file when done and with null when a pause took
 * effect; the pause itself yields the state a later launch continues from.
 */
function track(task: DownloadTask, transfer: Promise<File | null>): ModelDownload {
  return {
    done: transfer.then((file) => (file === null ? 'paused' : 'completed')),
    pause: async () => {
      if (task.state !== 'active') {
        return null;
      }

      await task.pauseAsync();

      /*
       * The platform gives resume data only for a transfer it can continue —
       * nothing before the first bytes, nothing for a server it cannot ask
       * for a range. A saved state without it cannot be restored at all, so
       * it is not saved: starting over is the honest answer there.
       */
      const saved = task.savable();

      return typeof saved.resumeData === 'string' && saved.resumeData.length > 0
        ? JSON.stringify(saved)
        : null;
    },
  };
}
