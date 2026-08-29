import type { Locale } from '../index';

import privacyEn from './privacy.en.json';
import privacyUk from './privacy.uk.json';
import termsEn from './terms.en.json';
import termsUk from './terms.uk.json';

/**
 * The two documents, in the shape the screen renders. Written by
 * `scripts/build-legal.mjs` out of the markdown in `legal/`, which is the
 * source: the pages on the website and these screens have to be the same text,
 * and keeping two copies by hand is how they stop being.
 */
export type LegalDocumentKind = 'terms' | 'privacy';

/** Exactly one field is set on any block. */
export interface LegalBlock {
  readonly heading?: string;
  readonly sub?: string;
  /** Emphasis survives as `*runs like this*`. */
  readonly text?: string;
  readonly bullets?: readonly string[];
  /** A table from the markdown: the first cell names the thing, the rest describe it. */
  readonly rows?: readonly (readonly string[])[];
}

export interface LegalDocument {
  readonly title: string;
  readonly blocks: readonly LegalBlock[];
}

const DOCUMENTS: Readonly<Record<LegalDocumentKind, Readonly<Record<Locale, LegalDocument>>>> = {
  terms: { uk: termsUk, en: termsEn },
  privacy: { uk: privacyUk, en: privacyEn },
};

export function legalDocument(kind: LegalDocumentKind, locale: Locale): LegalDocument {
  return DOCUMENTS[kind][locale];
}
