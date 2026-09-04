import type { SpeechModelState } from '../../domain/ports/ISpeechModel';

export type Progress = (writtenBytes: number, totalBytes: number | null) => void;

/** A download in flight, and the one thing that can be done to it. */
export interface ModelDownload {
  /** Settles when the file is whole, or when a pause took effect. */
  readonly done: Promise<'completed' | 'paused'>;
  /**
   * Stops the transfer and hands back what a later launch needs to continue
   * it — opaque text, or null when the platform had nothing to give.
   */
  pause(): Promise<string | null>;
}

/** What the store needs from a filesystem, and nothing more. */
export interface ModelStorage {
  /** Bytes on disk, or null when there is no such file. */
  sizeOf(name: string): Promise<number | null>;
  startDownload(url: string, name: string, onProgress: Progress): ModelDownload;
  /** Continues a download from what `pause` handed back, possibly launches ago. */
  resumeDownload(saved: string, onProgress: Progress): ModelDownload;
  rename(from: string, to: string): Promise<void>;
  remove(name: string): Promise<void>;
  uriFor(name: string): string;
  /** A small text file beside the model, for what the store must remember. */
  writeNote(name: string, text: string): Promise<void>;
  readNote(name: string): Promise<string | null>;
}

/**
 * The model as the system may already have delivered it — an Apple-hosted
 * asset pack on iOS 26 and later. Asked before any download is considered.
 */
export interface PreinstalledModel {
  /** Where the model file is on disk, or null when the system has not brought it. */
  uriFor(model: SpeechModelDescriptor): string | null;
}

export interface SpeechModelDescriptor {
  readonly url: string;
  readonly fileName: string;
  /** The Apple-hosted asset pack carrying this file: letters, digits and hyphens only. */
  readonly assetPackID: string;
  /** Which of whisper.rn's two engines reads these weights. */
  readonly engine: 'whisper' | 'parakeet';
  /**
   * Anything smaller than this is not the model. Catches both halves of a
   * truncated download and the case where a server answers 200 with an error
   * page — which weighs kilobytes and would otherwise be renamed into place
   * and handed to whisper as if it were weights.
   */
  readonly leastPlausibleBytes: number;
}

/**
 * Whisper, kept for comparison rather than use. Its Ukrainian was the reason
 * §10 nearly stopped the project; see BACKLOG §1b and §1c.
 */
export const TURBO_Q5_0: SpeechModelDescriptor = {
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
  fileName: 'ggml-large-v3-turbo-q5_0.bin',
  assetPackID: 'whisper-large-v3-turbo-q5',
  engine: 'whisper',
  leastPlausibleBytes: 500 * 1024 * 1024,
};

/**
 * What the app runs. Faster than Whisper by 3.7x on the phone and markedly
 * more accurate on Ukrainian in practice, which is what §10 had been asking
 * for since the start. See BACKLOG §1c.
 */
export const PARAKEET_TDT_Q8: SpeechModelDescriptor = {
  url: 'https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin',
  fileName: 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin',
  assetPackID: 'parakeet-tdt-06b-v3-q8',
  engine: 'parakeet',
  leastPlausibleBytes: 600 * 1024 * 1024,
};

/** The one the app downloads and runs. Swapping engines is this line. */
export const SPEECH_MODEL: SpeechModelDescriptor = PARAKEET_TDT_Q8;

const PARTIAL_SUFFIX = '.part';
const PAUSE_SUFFIX = '.paused';

/**
 * Puts the speech model on the device and says whether it is there.
 *
 * Half a gigabyte over a phone connection fails often enough that the failure
 * path is the design: the file is only ever named as the model once it is
 * whole, so an interrupted download can never be mistaken for a usable one.
 *
 * A download that is paused rather than dropped survives the app: what the
 * platform hands back at the pause is kept beside the model, and the next
 * `fetch` — this launch or a later one — continues from the same byte instead
 * of the first. The platform checks for itself that the file has not changed
 * underneath, so nothing here has to.
 */
export class SpeechModelStore {
  private inFlight: Promise<SpeechModelState> | null = null;
  private current: ModelDownload | null = null;
  private lastSeen: SpeechModelState = { kind: 'absent' };

  constructor(
    private readonly storage: ModelStorage,
    private readonly preinstalled: PreinstalledModel = { uriFor: () => null },
    private readonly model: SpeechModelDescriptor = SPEECH_MODEL,
  ) {}

  async state(): Promise<SpeechModelState> {
    // Brought by the system with the install: nothing to fetch, ever.
    const delivered = this.preinstalled.uriFor(this.model);

    if (delivered !== null) {
      return { kind: 'ready', uri: delivered };
    }

    const size = await this.storage.sizeOf(this.model.fileName);

    if (size === null || size < this.model.leastPlausibleBytes) {
      return { kind: 'absent' };
    }

    return { kind: 'ready', uri: this.storage.uriFor(this.model.fileName) };
  }

  /**
   * Safe to call again while a download is running — the second caller joins
   * the first rather than starting a competing one, which on this file size
   * would mean a wasted half a gigabyte.
   *
   * Resolves with `fetching` when the download was paused rather than
   * finished: not an outcome, but where things stand, and the next call
   * carries on from there.
   */
  fetch(onProgress: (state: SpeechModelState) => void = () => {}): Promise<SpeechModelState> {
    this.inFlight ??= this.run(onProgress).finally(() => {
      this.inFlight = null;
      this.current = null;
    });

    return this.inFlight;
  }

  /**
   * What a launch may do: continue a download an earlier launch paused, and
   * nothing else. Null when there is no pause to continue — the network is
   * not touched, because the one tap that started the download is the
   * consent to half a gigabyte over whatever connection the phone is on,
   * and opening the app is not.
   */
  async resume(
    onProgress: (state: SpeechModelState) => void = () => {},
  ): Promise<SpeechModelState | null> {
    if (this.inFlight !== null) {
      return this.inFlight;
    }

    const saved = await this.storage.readNote(this.pauseNote());

    return saved === null ? null : this.fetch(onProgress);
  }

  /**
   * Stops a running download and keeps what is needed to continue it. Nothing
   * to stop is not an error: the app pauses on the way to the background
   * whether or not anything was downloading.
   */
  async pause(): Promise<void> {
    const download = this.current;

    if (download === null) {
      return;
    }

    const saved = await download.pause();

    if (saved !== null) {
      await this.storage.writeNote(this.pauseNote(), saved);
    }
  }

  private async run(
    onProgress: (state: SpeechModelState) => void,
  ): Promise<SpeechModelState> {
    const existing = await this.state();

    if (existing.kind === 'ready') {
      return existing;
    }

    const partial = `${this.model.fileName}${PARTIAL_SUFFIX}`;
    const report: Progress = (writtenBytes, totalBytes) => {
      this.lastSeen = { kind: 'fetching', writtenBytes, totalBytes };
      onProgress(this.lastSeen);
    };

    const saved = await this.storage.readNote(this.pauseNote());

    let download: ModelDownload | null = null;

    if (saved !== null) {
      await this.storage.remove(this.pauseNote());

      try {
        download = this.storage.resumeDownload(saved, report);
      } catch {
        // A saved state the platform will not take back — it can refuse one
        // it wrote itself — is a fresh start, not a failure to report.
        download = null;
      }
    }

    if (download === null) {
      // A part with nothing to continue it from is a part of a download that
      // died, and the platform cannot pick that up. Starting over is slower
      // but never silently wrong.
      await this.storage.remove(partial);
      download = this.storage.startDownload(this.model.url, partial, report);
    }

    this.current = download;

    let outcome: 'completed' | 'paused';

    try {
      outcome = await download.done;
    } catch {
      await this.storage.remove(partial);

      return { kind: 'failed', reason: 'unreachable' };
    }

    if (outcome === 'paused') {
      return this.lastSeen;
    }

    const size = await this.storage.sizeOf(partial);

    if (size === null || size < this.model.leastPlausibleBytes) {
      await this.storage.remove(partial);

      return { kind: 'failed', reason: 'truncated' };
    }

    await this.storage.rename(partial, this.model.fileName);

    return { kind: 'ready', uri: this.storage.uriFor(this.model.fileName) };
  }

  private pauseNote(): string {
    return `${this.model.fileName}${PAUSE_SUFFIX}`;
  }
}
