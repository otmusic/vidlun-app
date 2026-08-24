import { NoRecordingProducedError, RecordingCancelledError } from '../../domain/errors/RecordingErrors';
import type { AudioRecording, IAudioRecorder } from '../../domain/ports/IAudioRecorder';
import type { IScheduler } from '../system/IScheduler';

/** The part of expo-audio's `AudioRecorder` this adapter drives. */
export interface NativeRecorder {
  readonly uri: string | null;
  prepareToRecordAsync(options?: { isMeteringEnabled?: boolean }): Promise<void>;
  record(): void;
  stop(): Promise<void>;
  getStatus(): {
    readonly durationMillis: number;
    readonly isRecording: boolean;
    readonly metering?: number;
  };
}

/**
 * iOS refuses to record until the audio session is switched to a category that
 * permits it, and expo-audio leaves `allowsRecording` false by default. Passed
 * in rather than imported so this adapter stays testable without a device.
 */
export type EnableRecordingMode = () => Promise<void>;

export interface SilenceOptions {
  /** dBFS below which the microphone counts as hearing nothing. */
  readonly silenceThresholdDb: number;
  /** How long that has to hold before the take ends by itself. */
  readonly silenceDurationMs: number;
  /** A hard ceiling, so a forgotten recording cannot run all day. */
  readonly maxDurationMs: number;
  readonly pollIntervalMs: number;
}

export const DEFAULT_SILENCE_OPTIONS: SilenceOptions = {
  silenceThresholdDb: -45,
  silenceDurationMs: 1500,
  maxDurationMs: 60_000,
  pollIntervalMs: 150,
};

interface Take {
  readonly resolve: (recording: AudioRecording) => void;
  readonly reject: (reason: Error) => void;
  readonly stopWatching: () => void;
}

/**
 * expo-audio exposes recording through a React hook, so the recorder instance
 * is created by the screen and handed in here. That keeps this adapter out of
 * the component tree and off any one platform.
 */
export class ExpoAudioRecorder implements IAudioRecorder {
  private take: Take | null = null;
  private silentForMs = 0;
  private hasHeardAnything = false;

  constructor(
    private readonly recorder: NativeRecorder,
    private readonly enableRecordingMode: EnableRecordingMode,
    private readonly scheduler: IScheduler,
    private readonly options: SilenceOptions = DEFAULT_SILENCE_OPTIONS,
  ) {}

  async start(): Promise<AudioRecording> {
    // Before preparing, not after: on iOS both `prepareToRecordAsync` and
    // `record` throw while the session still forbids recording.
    await this.enableRecordingMode();
    await this.recorder.prepareToRecordAsync({ isMeteringEnabled: true });

    this.silentForMs = 0;
    this.hasHeardAnything = false;
    this.recorder.record();

    return new Promise<AudioRecording>((resolve, reject) => {
      const stopWatching = this.scheduler.every(this.options.pollIntervalMs, () => {
        this.onTick();
      });

      this.take = { resolve, reject, stopWatching };
    });
  }

  stop(): void {
    void this.finish();
  }

  cancel(): void {
    const take = this.endTake();

    if (take === null) {
      return;
    }

    void this.recorder.stop().finally(() => {
      take.reject(new RecordingCancelledError());
    });
  }

  private onTick(): void {
    const status = this.recorder.getStatus();

    if (status.durationMillis >= this.options.maxDurationMs) {
      void this.finish();

      return;
    }

    // Without metering there is nothing to listen to, so the take runs until
    // the user ends it or the ceiling does.
    if (status.metering === undefined) {
      return;
    }

    if (status.metering > this.options.silenceThresholdDb) {
      this.hasHeardAnything = true;
      this.silentForMs = 0;

      return;
    }

    // Silence before the first word is someone working up to it, not a finished
    // sentence.
    if (!this.hasHeardAnything) {
      return;
    }

    this.silentForMs += this.options.pollIntervalMs;

    if (this.silentForMs >= this.options.silenceDurationMs) {
      void this.finish();
    }
  }

  private async finish(): Promise<void> {
    const take = this.endTake();

    if (take === null) {
      return;
    }

    try {
      const durationMs = this.recorder.getStatus().durationMillis;

      await this.recorder.stop();

      const uri = this.recorder.uri;

      if (uri === null) {
        take.reject(new NoRecordingProducedError());

        return;
      }

      take.resolve({ uri, durationMs });
    } catch (failure) {
      take.reject(failure instanceof Error ? failure : new NoRecordingProducedError());
    }
  }

  /** Claims the current take so that two endings cannot settle one promise. */
  private endTake(): Take | null {
    const take = this.take;

    if (take === null) {
      return null;
    }

    this.take = null;
    take.stopWatching();

    return take;
  }
}
