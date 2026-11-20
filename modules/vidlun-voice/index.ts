import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeVoice {
  analyze(uri: string): Promise<Record<string, unknown>>;
  speechSpans(uri: string): Promise<unknown>;
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
