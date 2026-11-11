import type { IReviewPrompt } from '../../domain/ports/IReviewPrompt';

/** Whether this build carries a native module, asked the way expo itself asks. */
export type CarriesNativeModule = (name: string) => boolean;

const STORE_REVIEW = 'ExpoStoreReview';

/**
 * Apple's rating sheet through expo-store-review. The module is loaded when
 * it is first needed rather than on start, and only once the build is known
 * to carry it: importing it into a build that does not throws from inside
 * the module loader, which reports it as fatal however the call is caught —
 * a red screen after saving in an older simulator build (2026-11-11), a
 * crash in a release one. A rating request is never worth either.
 */
export class ExpoReviewPrompt implements IReviewPrompt {
  constructor(private readonly carries: CarriesNativeModule) {}

  async request(): Promise<void> {
    if (!this.carries(STORE_REVIEW)) {
      return;
    }

    const StoreReview = await import('expo-store-review');

    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  }
}
