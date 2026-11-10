import type { IReviewPrompt } from '../../domain/ports/IReviewPrompt';

/**
 * Apple's rating sheet through expo-store-review. The module is loaded when
 * it is first needed rather than on start: it throws on import in a build
 * that does not carry it, and a rating request is never worth a launch.
 */
export class ExpoReviewPrompt implements IReviewPrompt {
  async request(): Promise<void> {
    const StoreReview = await import('expo-store-review');

    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  }
}
