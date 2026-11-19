import type { VoiceHeard, VoiceMark } from '@/domain/value-objects/VoiceCue';
import type { Translate, TranslationKey } from '@/i18n';

/** The marks that say something about the voice itself, as one word each. */
const TRAITS: Partial<Record<VoiceMark, TranslationKey>> = {
  quieter: 'voice.quieter',
  louder: 'voice.louder',
  lower: 'voice.lower',
  higher: 'voice.higher',
  flatter: 'voice.flatter',
  livelier: 'voice.livelier',
  slower: 'voice.slower',
  faster: 'voice.faster',
};

/**
 * The line under an entry's player, about how the voice sounded (owner's
 * word, 2026-11-19, variant A). Always about the voice, never the person, and
 * against their own usual voice, never a norm: "your voice is quieter and
 * slower than usual". The voice is the subject, so in Ukrainian no gender
 * shows. Pauses are not a quality of the voice and join as a clause of their
 * own.
 *
 * Null while it is being worked out, and when there is nothing honest to say.
 */
export function voiceLine(heard: VoiceHeard | null, t: Translate): string | null {
  if (heard === null || heard.kind === 'silent') {
    return null;
  }

  if (heard.kind === 'learning') {
    return t('voice.learning');
  }

  const traits = heard.cue.marks.flatMap((mark) => {
    const key = TRAITS[mark];

    return key === undefined ? [] : [t(key)];
  });
  const pauses = heard.cue.marks.includes('more pauses')
    ? 'more'
    : heard.cue.marks.includes('fewer pauses')
      ? 'fewer'
      : null;

  if (traits.length === 0) {
    return pauses === null
      ? t('voice.asUsual')
      : t(pauses === 'more' ? 'voice.morePausesOnly' : 'voice.fewerPausesOnly');
  }

  const list = joinList(traits, t('voice.and'));

  return pauses === null
    ? t('voice.traits', { traits: list })
    : t('voice.traitsAndPauses', {
        traits: list,
        pauses: t(pauses === 'more' ? 'voice.morePauses' : 'voice.fewerPauses'),
      });
}

/** "a", "a and b", "a, b and c", with the locale's own "and". */
function joinList(items: readonly string[], and: string): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }

  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1] ?? ''}`;
}
