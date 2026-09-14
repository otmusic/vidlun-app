/** The language a person speaks into the journal. The interface language is only its default. */
export type SpeechLanguage = 'uk' | 'en';

/**
 * What turns a take into words. Both run on the device and neither sends
 * audio anywhere. Apple's recogniser knows English and not Ukrainian, and
 * cannot follow a sentence that mixes Ukrainian with Russian; Vidlun's own
 * model can, and costs 668 MB. So the engine follows the language spoken and
 * is never a preference of its own.
 */
export type SpeechEngine = 'apple' | 'vidlun';

/**
 * `appleAvailable` is whether this device can read English by itself — iOS 26
 * and later. Where it cannot, the model reads English too, as it always has.
 */
export function engineFor(language: SpeechLanguage, appleAvailable: boolean): SpeechEngine {
  return language === 'en' && appleAvailable ? 'apple' : 'vidlun';
}
