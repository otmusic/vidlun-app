/** Injected so that entry timestamps are fixed in tests instead of flaky. */
export interface IClock {
  now(): Date;
}
