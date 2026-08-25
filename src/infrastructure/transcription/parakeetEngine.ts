/*
 * '/index' is not a slip — see the note in whisperEngine.ts. whisper.rn's
 * exports map has no entry for the package root.
 */
import { initParakeet } from 'whisper.rn/index';

import type { OpenSpeechEngine, SpeechEngine } from './OnDeviceTranscriptionService';
import { toNativePath } from './whisperEngine';

/**
 * NVIDIA Parakeet TDT, which whisper.rn runs through the same whisper.cpp
 * build as Whisper. This is what the app transcribes with.
 *
 * Chosen on 2026-08-25 after Whisper's Ukrainian proved unusable in practice
 * and nothing cheap fixed it. On the phone Parakeet is 3.7x faster — 2.1 s
 * against 7.9 for a longer recording — and the transcripts came back clean
 * where Whisper had been inventing words. See BACKLOG §1c.
 *
 * It takes no language hint: the model is multilingual without one. That makes
 * the short-take language choice in OnDeviceTranscriptionService inert, which
 * backlog 1.6 now covers.
 */
export function openParakeetEngine(modelUri: string): OpenSpeechEngine {
  return async (): Promise<SpeechEngine> => {
    const context = await initParakeet({ filePath: toNativePath(modelUri), useGpu: true });

    return {
      transcribe: (filePath) => context.transcribe(toNativePath(filePath)),
    };
  };
}
