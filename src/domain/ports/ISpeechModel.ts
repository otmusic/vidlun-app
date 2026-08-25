export type SpeechModelFailure =
  /** The download did not finish: no connection, or it was cut off. */
  | 'unreachable'
  /** It finished, but what arrived is too small to be the model. */
  | 'truncated';

/**
 * Where the on-device speech model is up to. Lives here rather than beside the
 * store because onboarding shows it, and §3 keeps presentation out of
 * infrastructure.
 */
export type SpeechModelState =
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'fetching';
      readonly writtenBytes: number;
      /** Null when the server sent no Content-Length. */
      readonly totalBytes: number | null;
    }
  | { readonly kind: 'ready'; readonly uri: string }
  | { readonly kind: 'failed'; readonly reason: SpeechModelFailure };
