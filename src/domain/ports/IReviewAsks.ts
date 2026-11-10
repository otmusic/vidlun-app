/** Which version of the app last asked for a rating, so it asks once a version. */
export interface IReviewAsks {
  askedIn(): Promise<string | null>;
  remember(version: string): Promise<void>;
}
