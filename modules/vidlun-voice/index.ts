import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeVoice {
  analyze(uri: string): Promise<Record<string, unknown>>;
  speechSpans(uri: string): Promise<unknown>;
  montageLengths?: (uris: readonly string[]) => Promise<unknown>;
  setTrackCommands?: (enabled: boolean) => void;
  addListener?: (
    event: 'onTrackCommand',
    listener: (payload: { readonly direction?: unknown }) => void,
  ) => { remove(): void };
  composeMontage?: (
    clips: readonly NativeMontageClip[],
    out: string,
    gapMs: number,
    fadeInMs: number,
    fadeOutMs: number,
  ) => Promise<unknown>;
}

/** A stretch of one kept take, as the native side reads it. */
export interface NativeMontageClip {
  readonly uri: string;
  readonly fromMs: number;
  readonly toMs: number;
  /** True when the stretch stops before the take does, so it fades out. */
  readonly fadeOut: boolean;
}

/*
 * Optional on purpose, like the record request: the module exists where it
 * was built in. In tests, on Android for now, and in a dev build made before
 * it, it is absent, and absence means nothing can be measured.
 */
const native = requireOptionalNativeModule<NativeVoice>('VidlunVoice');

/** The raw measures of the recording at `uri`, or null where nothing can measure them. */
export function analyzeVoice(uri: string): Promise<Record<string, unknown>> | null {
  return native === null ? null : native.analyze(uri);
}

/**
 * Where the speech is in the recording at `uri`, as [from, to] pairs in
 * milliseconds, or null where nothing can read it. A build made before the
 * function existed has the module without it, which also reads as null.
 */
export function speechSpans(uri: string): Promise<unknown> | null {
  return native === null || typeof native.speechSpans !== 'function' ? null : native.speechSpans(uri);
}

/**
 * Each recording's length in milliseconds (-1 for one that cannot be read),
 * or null where nothing can measure them: no module, or a build made before
 * the function existed.
 */
export function montageLengths(uris: readonly string[]): Promise<unknown> | null {
  return native === null || typeof native.montageLengths !== 'function' ? null : native.montageLengths(uris);
}

/**
 * Joins the clips into one AAC file at `out`, a quiet gap between each, and
 * resolves to where each clip landed in it as [start, end] milliseconds
 * ([-1, -1] for one that could not be read). Null where nothing can join them.
 */
export function composeMontage(
  clips: readonly NativeMontageClip[],
  out: string,
  timing: { readonly gapMs: number; readonly fadeInMs: number; readonly fadeOutMs: number },
): Promise<unknown> | null {
  return native === null || typeof native.composeMontage !== 'function'
    ? null
    : native.composeMontage(clips, out, timing.gapMs, timing.fadeInMs, timing.fadeOutMs);
}

/** Which way the lock screen's buttons asked to go. */
export type TrackDirection = 'previous' | 'next';

/**
 * Puts ◀◀ ▶▶ on the lock screen and in the Dynamic Island while a month
 * plays, and hears them: `onTrack` is called with the way asked. Returns
 * what takes them away again. Does nothing where the module has no such
 * part (tests, a build made before it).
 */
export function listenForTracks(onTrack: (direction: TrackDirection) => void): () => void {
  if (native === null || typeof native.setTrackCommands !== 'function' || typeof native.addListener !== 'function') {
    return () => undefined;
  }

  const subscription = native.addListener('onTrackCommand', (payload) => {
    if (payload.direction === 'previous' || payload.direction === 'next') {
      onTrack(payload.direction);
    }
  });

  native.setTrackCommands(true);

  return () => {
    subscription.remove();
    native.setTrackCommands?.(false);
  };
}
