import { NoRecordingProducedError, RecordingCancelledError } from '../../domain/errors/RecordingErrors';
import type { AudioRecording, IAudioRecorder } from '../../domain/ports/IAudioRecorder';
import type { IScheduler } from '../system/IScheduler';

/** The part of expo-audio's `AudioRecorder` this adapter drives. */
export interface NativeRecorder {
  readonly uri: string | null;
  /**
   * Called with nothing on purpose. Anything passed here replaces the options
   * the recorder was built with, format and all.
   */
  prepareToRecordAsync(): Promise<void>;
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

/**
 * The take ends when the person ends it. Silence used to end it after a second
 * and a half, which read as attentive and was not: someone gathering their
 * words mid-sentence is the most ordinary thing on a screen that asks how the
 * day went, and cutting them off there is the app deciding they had finished.
 * Pauses are now part of speaking.
 */
export interface RecordingLimits {
  /**
   * A ceiling, not a timer — it exists so a recording left running in a pocket
   * cannot fill the disk, and it is set far past any entry anyone would make.
   */
  readonly maxDurationMs: number;
  readonly pollIntervalMs: number;
}

export const DEFAULT_RECORDING_LIMITS: RecordingLimits = {
  maxDurationMs: 300_000,
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

  constructor(
    private readonly recorder: NativeRecorder,
    private readonly enableRecordingMode: EnableRecordingMode,
    private readonly scheduler: IScheduler,
    private readonly options: RecordingLimits = DEFAULT_RECORDING_LIMITS,
  ) {}

  async start(): Promise<AudioRecording> {
    // Before preparing, not after: on iOS both `prepareToRecordAsync` and
    // `record` throw while the session still forbids recording.
    await this.enableRecordingMode();
    await this.recorder.prepareToRecordAsync();

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
    if (this.recorder.getStatus().durationMillis >= this.options.maxDurationMs) {
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
