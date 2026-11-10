/** The version the store sells now, and where its page is. */
export interface StoreRelease {
  readonly version: string;
  readonly url: string;
}

/**
 * The store's listing of this app. Null when the store does not list it,
 * which is a real answer: a build in review, or a country it is not sold in.
 */
export interface IStoreListing {
  latest(): Promise<StoreRelease | null>;
}
