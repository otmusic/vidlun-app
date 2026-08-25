/*
 * '/index' is not a slip. whisper.rn's exports map declares only './*' and has
 * no entry for the package root, so importing 'whisper.rn' resolves at runtime
 * through Metro but not for TypeScript. Shortening this path breaks typecheck.
 */
import { initWhisper } from 'whisper.rn/index';

import type { OpenSpeechEngine, SpeechEngine } from './OnDeviceTranscriptionService';

/**
 * expo-file-system hands out `file:///` URIs; whisper.rn wants a plain path.
 * Passing the URI through produces a file-not-found from inside native code,
 * a long way from the mistake.
 */
export function toNativePath(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri;
}

/** Loads the model once, on the first take that needs it. */
export function openSpeechEngine(modelUri: string): OpenSpeechEngine {
  return async (): Promise<SpeechEngine> => {
    const context = await initWhisper({ filePath: toNativePath(modelUri) });

    return {
      transcribe: (filePath, options) => context.transcribe(toNativePath(filePath), options),
    };
  };
}
