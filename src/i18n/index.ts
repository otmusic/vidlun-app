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

export function createTranslator(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale];

  return (key, params) => interpolate(dictionary[key], params);
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
