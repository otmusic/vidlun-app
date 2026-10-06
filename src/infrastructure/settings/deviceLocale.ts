import { getCalendars, getLocales } from 'expo-localization';

import type { Settings } from '../../domain/ports/ISettings';
import { inUkraine } from './inUkraine';

/** Read when asked rather than at launch, so a phone that travelled answers for where it is. */
export function deviceInUkraine(): boolean {
  return inUkraine(getLocales()[0]?.regionCode ?? null, getCalendars()[0]?.timeZone ?? null);
}

/**
 * The language the phone is set to, when we speak it.
 *
 * English is the fallback rather than Ukrainian, even though §1 names a
 * Ukrainian-speaking audience: someone whose phone is in Ukrainian gets
 * Ukrainian from this, and everyone else is better served by the language most
 * likely to be their second than by one they may not read at all.
 *
 * Region is ignored on purpose. `uk-UA` and a Ukrainian speaker abroad want the
 * same words.
 */
export function detectLocale(): Settings['locale'] {
  for (const locale of getLocales()) {
    if (locale.languageCode === 'uk') {
      return 'uk';
    }

    if (locale.languageCode === 'en') {
      return 'en';
    }
  }

  return 'en';
}
