/**
 * The store's own rating sheet. Apple allows no other kind (App Review 5.6.1)
 * and decides itself whether to show it: at most three times a year, and not
 * to someone who already rated, until a new version and a year have passed.
 * So a request is a request, and nothing comes back to say what happened.
 */
export interface IReviewPrompt {
  request(): Promise<void>;
}
