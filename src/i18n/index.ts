import enAffirmations from './locales/affirmations.en.json';
import ukAffirmations from './locales/affirmations.uk.json';
import enEmotions from './locales/emotions.en.json';
import ukEmotions from './locales/emotions.uk.json';
import enInterface from './locales/en.json';
import ukInterface from './locales/uk.json';

export const LOCALES = ['en', 'uk'] as const;

export type Locale = (typeof LOCALES)[number];

// Interface copy and emotion labels are kept in separate files because they
// change for different reasons, and merged here so there is still one `t`.
const en = { ...enInterface, ...enEmotions };
const uk = { ...ukInterface, ...ukEmotions };

/** Every display string in the app is one of these keys. */
export type TranslationKey = keyof typeof en;

export type TranslationParams = Readonly<Record<string, string | number>>;

export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

type Dictionary = Readonly<Record<TranslationKey, string>>;

export const DEFAULT_LOCALE: Locale = 'en';

// Typing every dictionary as complete makes a missing translation a
// typecheck failure rather than a blank label at runtime.
const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = {
  en,
  uk,
};

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export function isLocale(candidate: string): candidate is Locale {
  return (LOCALES as readonly string[]).includes(candidate);
}

const CYRILLIC = /[\u0400-\u04FF]/g;
const LATIN = /[A-Za-z\u00C0-\u024F]/g;

/**
 * The language a piece of writing is in, as far as its letters tell: the
 * script most of them are in. Cyrillic reads as Ukrainian — the one Cyrillic
 * language the app has, and the nearest for an entry said in Russian — and
 * Latin as English. Null when there are no letters to go by.
 */
export function localeOfText(text: string): Locale | null {
  const cyrillic = text.match(CYRILLIC)?.length ?? 0;
  const latin = text.match(LATIN)?.length ?? 0;

  if (cyrillic === latin) {
    return null;
  }

  return cyrillic > latin ? 'uk' : 'en';
}

const AFFIRMATIONS: Readonly<Record<Locale, readonly string[]>> = {
  en: enAffirmations,
  uk: ukAffirmations,
};

/**
 * The affirmations the cards are dealt from, in the app's language. A list
 * per language rather than one list translated: the owner wrote the two
 * apart (2026-11-10), nineteen in Ukrainian and thirty-three in English, so
 * neither is the other's translation and they need not be the same length.
 * Adding one is a line in that language's affirmations.*.json.
 */
export function affirmationsFor(locale: Locale): readonly string[] {
  return AFFIRMATIONS[locale];
}

export function createTranslator(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale];

  return (key, params) => interpolate(dictionary[key], params);
}

/**
 * The vocabulary id whose label a typed word already is, in either language,
 * or null. A person who types "sad" or "tired" means the word the palette
 * has, and keeping it as that word keeps its colour, its place in search and
 * its depth in the granularity metric. Case and spacing are ignored. Where
 * two emotions share a label, the broader word wins: fewer dots, shallower.
 */
export function emotionIdForLabel(typed: string): string | null {
  const wanted = typed.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

  if (wanted.length === 0) {
    return null;
  }

  let best: string | null = null;

  for (const labels of [enEmotions, ukEmotions]) {
    for (const [key, label] of Object.entries(labels)) {
      if (label.toLocaleLowerCase() !== wanted) {
        continue;
      }

      const id = key.slice(EMOTION_PREFIX.length);

      if (best === null || depthOf(id) < depthOf(best)) {
        best = id;
      }
    }
  }

  return best;
}

const EMOTION_PREFIX = 'emotion.';

function depthOf(id: string): number {
  return id.split('.').length;
}

/**
 * Emotion ids are the join key between the vocabulary and its labels. The cast
 * is covered by a test asserting every shipped id has a label in every locale.
 */
export function emotionKey(emotionId: string): TranslationKey {
  return `emotion.${emotionId}` as TranslationKey;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (params === undefined) {
    return template;
  }

  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = params[name];

    return value === undefined ? placeholder : String(value);
  });
}
