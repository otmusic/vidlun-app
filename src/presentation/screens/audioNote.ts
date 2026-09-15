import type { EntrySource } from '@/domain/entities/MoodEntry';
import type { TranslationKey } from '@/i18n';

/**
 * What to say where the player would be, when there is nothing to play.
 *
 * A typed entry never had a voice, and saying "recordings are off" over it
 * accuses a setting that may well be on. A spoken entry without audio lost
 * it either because recordings are off — the one reason the person can
 * change, so it is named — or for a reason settings no longer explain:
 * they were off when it was recorded and are on now, or thirteen months
 * have passed. Those two get a line that claims nothing about settings.
 */
export function audioNoteKey(source: EntrySource, keepRecordings: boolean): TranslationKey {
  if (source === 'text') {
    return 'detail.audioTyped';
  }

  return keepRecordings ? 'detail.audioMissing' : 'detail.audioGone';
}
