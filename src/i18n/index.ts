import enTranslations from './locales/en.json';
import ukTranslations from './locales/uk.json';

export const LOCALES = ['en', 'uk'] as const;

export type Locale = (typeof LOCALES)[number];

/** Every display string in the app is one of these keys. */
export type TranslationKey = keyof typeof enTranslations;

export type TranslationParams = Readonly<Record<string, string | number>>;

export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

type Dictionary = Readonly<Record<TranslationKey, string>>;

export const DEFAULT_LOCALE: Locale = 'en';

// Typing every dictionary as complete makes a missing translation a
// typecheck failure rather than a blank label at runtime.
const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = {
  en: enTranslations,
  uk: ukTranslations,
};

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export function isLocale(candidate: string): candidate is Locale {
  return (LOCALES as readonly string[]).includes(candidate);
}

export function createTranslator(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale];

  return (key, params) => interpolate(dictionary[key], params);
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
