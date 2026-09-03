import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeAssetPack {
  isAvailable(packID: string): boolean;
  fileURL(packID: string, path: string): string | null;
}

/*
 * Optional on purpose: the module exists only where it was built in — on the
 * phone. In tests, on the web, and on Android for now, it is simply absent,
 * and absence reads as "no pack here", which is the right answer there too.
 */
const native = requireOptionalNativeModule<NativeAssetPack>('VidlunAssetPack');

/** Whether the pack has been delivered to this device by the system. */
export function isAssetPackAvailable(packID: string): boolean {
  return native?.isAvailable(packID) ?? false;
}

/** Where a file inside a delivered pack lives, or null when it is not here. */
export function assetPackFileURL(packID: string, path: string): string | null {
  return native?.fileURL(packID, path) ?? null;
}
