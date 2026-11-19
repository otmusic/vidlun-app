import type { VoiceMeasure, VoiceScale } from '@/domain/value-objects/VoiceCue';
import type { TranslationKey } from '@/i18n';

/**
 * How many of the person's own spreads either side of their usual middle the
 * line spans. Wider than any mark (one and a half at most), so the band sits
 * well inside the line and a marked take lands clearly outside it.
 */
const REACH = 3;

/** Kept off the very ends, so the dot never sits half outside its line. */
const EDGE = 4;

/** Where on the line, in percent from the left, a take sits: less to the left, more to the right. */
export function placeOnScale(away: number): number {
  const place = 50 + (away / REACH) * 50;

  return Math.min(100 - EDGE, Math.max(EDGE, place));
}

/** The usual band, in percent from the left: what still counts as this person's usual. */
export function usualBand(usualWithin: number): { readonly from: number; readonly to: number } {
  const half = Math.min(50, (usualWithin / REACH) * 50);

  return { from: 50 - half, to: 50 + half };
}

const MEASURE_NAMES: Record<VoiceMeasure, TranslationKey> = {
  loudness: 'voice.scale.loudness',
  pitch: 'voice.scale.pitch',
  liveliness: 'voice.scale.liveliness',
  pace: 'voice.scale.pace',
  pauses: 'voice.scale.pauses',
};

/** The measure's name, as the row says it. */
export function measureNameKey(measure: VoiceMeasure): TranslationKey {
  return MEASURE_NAMES[measure];
}

/** The one word at the end of a row: how this take differed, or that it did not. */
export function scaleWordKey(scale: VoiceScale): TranslationKey {
  switch (scale.mark) {
    case 'quieter':
      return 'voice.word.quieter';
    case 'louder':
      return 'voice.word.louder';
    case 'lower':
      return 'voice.word.lower';
    case 'higher':
      return 'voice.word.higher';
    case 'flatter':
      return 'voice.word.flatter';
    case 'livelier':
      return 'voice.word.livelier';
    case 'slower':
      return 'voice.word.slower';
    case 'faster':
      return 'voice.word.faster';
    case 'more pauses':
      return 'voice.word.more';
    case 'fewer pauses':
      return 'voice.word.fewer';
    case null:
      return 'voice.word.usual';
  }
}
