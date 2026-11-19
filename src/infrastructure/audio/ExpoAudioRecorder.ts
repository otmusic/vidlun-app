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
  pause(): void;
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
export type SetRecordingMode = (allowed: boolean) => Promise<void>;

/**
 * The screen held on while the microphone is open (owner's report,
 * 2026-11-10: the phone dimmed and locked itself mid-entry, and the take
 * stopped hearing them). Locking sends the app to the background, where the
 * take is paused on purpose, so the fix is that a phone left alone while
 * someone talks to it does not lock. A lock by hand still pauses and asks.
 */
export interface ScreenAwake {
  keepOn(): void;
  letSleep(): void;
}

/**
 * Removes a take's file. expo-audio records every take of one launch into
 * the same file in the cache and never removes it, so a take that was not
 * kept stayed there for good. Passed in so this adapter stays testable
 * without a device.
 */
export type RemoveTake = (uri: string) => void;

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
 * Where speech sits on the meter, in decibels below full scale: a quiet room
 * reads around -50, a voice close to the phone between -30 and -10. The
 * range in between is spread over 0 to 1 so a soft voice still moves the
 * bars and a loud one does not pin them.
 */
const QUIET_DB = -50;
const LOUD_DB = -12;

/** The meter's reading as a share of the speaking range; nothing heard is 0. */
export function levelFromDecibels(decibels: number | undefined): number {
  if (decibels === undefined || !Number.isFinite(decibels)) {
    return 0;
  }

  return Math.min(1, Math.max(0, (decibels - QUIET_DB) / (LOUD_DB - QUIET_DB)));
}

/**
 * expo-audio exposes recording through a React hook, so the recorder instance
 * is created by the screen and handed in here. That keeps this adapter out of
 * the component tree and off any one platform.
 */
export class ExpoAudioRecorder implements IAudioRecorder {
  private take: Take | null = null;
  private starting = false;
  /** Started or resumed, and not paused since: the take is meant to be hearing. */
  private listening = false;
  /**
   * The recorder has said it is recording since the take last began listening.
   * Until then a status that says otherwise is the recorder catching up, not
   * the system taking the microphone away.
   */
  private heard = false;
  /** The system stopped the recorder under a take that was listening. */
  private heldBySystem = false;

  constructor(
    private readonly recorder: NativeRecorder,
    private readonly setRecordingMode: SetRecordingMode,
    private readonly scheduler: IScheduler,
    private readonly screen: ScreenAwake,
    private readonly removeTake: RemoveTake,
    private readonly options: RecordingLimits = DEFAULT_RECORDING_LIMITS,
  ) {}

  async start(): Promise<AudioRecording> {
    this.starting = true;

    try {
      // Before preparing, not after: on iOS both `prepareToRecordAsync` and
      // `record` throw while the session still forbids recording.
      await this.setRecordingMode(true);
      await this.recorder.prepareToRecordAsync();

      this.recorder.record();
    } finally {
      this.starting = false;
    }

    this.beginListening();
    this.screen.keepOn();

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

  /*
   * The recording mode goes off with the pause. expo-audio restarts every
   * paused recorder by itself when the app comes back to the front, and a
   * take that is waiting for the person's answer must not start listening
   * before they give it.
   */
  async pause(): Promise<void> {
    if (this.take === null) {
      return;
    }

    this.stopListening();
    this.recorder.pause();
    // A paused take may wait a long while for its answer; the phone may sleep meanwhile.
    this.screen.letSleep();
    await this.setRecordingMode(false);
  }

  async resume(): Promise<void> {
    if (this.take === null) {
      return;
    }

    await this.setRecordingMode(true);
    this.recorder.record();
    this.beginListening();
    this.screen.keepOn();
  }

  cancel(): void {
    const take = this.endTake();

    if (take === null) {
      return;
    }

    void this.recorder.stop().finally(() => {
      this.discard(this.recorder.uri);
      take.reject(new RecordingCancelledError());
    });
  }

  discard(uri: string | null): void {
    // Every take goes into the same file: one under way must keep it.
    if (uri === null || this.starting || this.take !== null) {
      return;
    }

    this.removeTake(uri);
  }

  level(): number {
    if (this.take === null) {
      return 0;
    }

    const status = this.recorder.getStatus();

    return status.isRecording ? levelFromDecibels(status.metering) : 0;
  }

  interrupted(): boolean {
    return this.take !== null && this.heldBySystem;
  }

  private onTick(): void {
    const status = this.recorder.getStatus();

    if (status.durationMillis >= this.options.maxDurationMs) {
      void this.finish();

      return;
    }

    this.watchForSystemHold(status.isRecording);
  }

  /*
   * expo-audio pauses every recorder when iOS interrupts the audio session —
   * a call answered or ringing, Siri, an alarm — and on the interruption's end
   * starts only its players again, never a recorder. Nothing tells the take,
   * so it is read off the status: a recorder that stopped recording while
   * nobody paused it was stopped by the system.
   */
  private watchForSystemHold(isRecording: boolean): void {
    if (!this.listening) {
      return;
    }

    if (isRecording) {
      this.heard = true;
    } else if (this.heard) {
      this.heldBySystem = true;
    }
  }

  private beginListening(): void {
    this.listening = true;
    this.heard = false;
    this.heldBySystem = false;
  }

  private stopListening(): void {
    this.listening = false;
    this.heldBySystem = false;
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
    this.stopListening();
    take.stopWatching();
    this.screen.letSleep();

    return take;
  }
}
