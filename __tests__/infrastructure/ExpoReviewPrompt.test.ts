import { ExpoReviewPrompt } from '@/infrastructure/review/ExpoReviewPrompt';

const storeReview = {
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
};

jest.mock('expo-store-review', () => storeReview);

describe('ExpoReviewPrompt', () => {
  beforeEach(() => {
    storeReview.requestReview.mockClear();
  });

  it('asks for the rating sheet in a build that carries it', async () => {
    await new ExpoReviewPrompt((name) => name === 'ExpoStoreReview').request();

    expect(storeReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('does nothing in a build that does not, rather than loading a module that is not there', async () => {
    await new ExpoReviewPrompt(() => false).request();

    expect(storeReview.requestReview).not.toHaveBeenCalled();
  });
});
