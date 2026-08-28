import { File } from 'expo-file-system';

import type { EncodedAudio, ReadAudio } from './GeminiTranscriptionService';

/**
 * The take, encoded for the request body. Kept apart from the adapter the way
 * the engines are kept apart from `OnDeviceTranscriptionService`: this is the
 * one line that needs the platform, and the adapter stays runnable in a test.
 */
export const readAudioBytes: ReadAudio = async (uri): Promise<EncodedAudio> => {
  const file = new File(uri);
  const base64 = await file.base64();

  // `size` is the honest number; the arithmetic is what base64 costs, used
  // only if the platform declines to report one.
  return { base64, byteLength: file.size ?? Math.floor((base64.length * 3) / 4) };
};
