import type { SpeechModelState } from '../../domain/ports/ISpeechModel';

/** What the store needs from a filesystem, and nothing more. */
export interface ModelStorage {
  /** Bytes on disk, or null when there is no such file. */
  sizeOf(name: string): Promise<number | null>;
  download(
    url: string,
    name: string,
    onProgress: (writtenBytes: number, totalBytes: number | null) => void,
  ): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(name: string): Promise<void>;
  uriFor(name: string): string;
}

export interface SpeechModelDescriptor {
  readonly url: string;
  readonly fileName: string;
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
  engine: 'parakeet',
  leastPlausibleBytes: 600 * 1024 * 1024,
};

/** The one the app downloads and runs. Swapping engines is this line. */
export const SPEECH_MODEL: SpeechModelDescriptor = PARAKEET_TDT_Q8;

const PARTIAL_SUFFIX = '.part';

/**
 * Puts the speech model on the device and says whether it is there.
 *
 * Half a gigabyte over a phone connection fails often enough that the failure
 * path is the design: the file is only ever named as the model once it is
 * whole, so an interrupted download can never be mistaken for a usable one.
 */
export class SpeechModelStore {
  private inFlight: Promise<SpeechModelState> | null = null;

  constructor(
    private readonly storage: ModelStorage,
    private readonly model: SpeechModelDescriptor = SPEECH_MODEL,
  ) {}

  async state(): Promise<SpeechModelState> {
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
   */
  fetch(onProgress: (state: SpeechModelState) => void = () => {}): Promise<SpeechModelState> {
    this.inFlight ??= this.run(onProgress).finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async run(
    onProgress: (state: SpeechModelState) => void,
  ): Promise<SpeechModelState> {
    const existing = await this.state();

    if (existing.kind === 'ready') {
      return existing;
    }

    const partial = `${this.model.fileName}${PARTIAL_SUFFIX}`;

    // Resuming across launches would need the server's resume token, which we
    // do not keep. Starting over is slower but never silently wrong.
    await this.storage.remove(partial);

    try {
      await this.storage.download(this.model.url, partial, (writtenBytes, totalBytes) => {
        onProgress({ kind: 'fetching', writtenBytes, totalBytes });
      });
    } catch {
      await this.storage.remove(partial);

      return { kind: 'failed', reason: 'unreachable' };
    }

    const size = await this.storage.sizeOf(partial);

    if (size === null || size < this.model.leastPlausibleBytes) {
      await this.storage.remove(partial);

      return { kind: 'failed', reason: 'truncated' };
    }

    await this.storage.rename(partial, this.model.fileName);

    return { kind: 'ready', uri: this.storage.uriFor(this.model.fileName) };
  }
}
