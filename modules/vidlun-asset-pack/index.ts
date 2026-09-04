import { requireOptionalNativeModule } from 'expo-modules-core';

export interface AssetPackProgress {
  readonly id: string;
  readonly completed: number;
  readonly total: number;
}

interface NativeAssetPack {
  fileURL(path: string): string | null;
  ensure(assetPackID: string): Promise<boolean>;
  addListener(event: 'progress', listener: (progress: AssetPackProgress) => void): { remove(): void };
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

/**
 * Asks the system to bring a pack now and waits for it. True once it is on
 * disk; false where the system cannot bring it — no module, an older iOS,
 * or a pack it does not know — so the caller may download by itself.
 * Rejects when the system knew the pack and could not deliver it.
 */
export function requestAssetPack(
  assetPackID: string,
  onProgress: (progress: AssetPackProgress) => void,
): Promise<boolean> {
  if (native === null) {
    return Promise.resolve(false);
  }

  const watching = native.addListener('progress', (progress) => {
    if (progress.id === assetPackID) {
      onProgress(progress);
    }
  });

  return native.ensure(assetPackID).finally(() => {
    watching.remove();
  });
}
