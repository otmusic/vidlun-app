import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeAssetPack {
  fileURL(path: string): string | null;
}

/*
 * Optional on purpose: the module exists only where it was built in — on the
 * phone. In tests, on the web, and on Android for now, it is simply absent,
 * and absence reads as "no pack here", which is the right answer there too.
 */
const native = requireOptionalNativeModule<NativeAssetPack>('VidlunAssetPack');

/**
 * Where a file inside a delivered asset pack lives, or null when no pack
 * holding it has arrived on this device. The system searches every pack the
 * app publishes, so the file name alone is the question.
 */
export function assetPackFileURL(path: string): string | null {
  return native?.fileURL(path) ?? null;
}
