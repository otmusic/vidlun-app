import type { VoiceReading } from './VoiceReading';

/** One way a take's voice stood apart from the person's usual voice. */
export type VoiceMark =
  | 'quieter'
  | 'louder'
  | 'lower'
  | 'higher'
  | 'flatter'
  | 'livelier'
  | 'slower'
  | 'faster'
  | 'more pauses'
  | 'fewer pauses';

/**
 * How one take sounded against the same person's other takes. No marks means
 * the voice sounded as it usually does, which is something to know too.
 *
 * Against the person, never against a norm: voices differ far more from one
 * another than one voice does from day to day, and a low voice is not a sad
 * one.
 */
export interface VoiceCue {
  readonly marks: readonly VoiceMark[];
}

/**
 * What can honestly be said about a saved entry's voice (owner's word,
 * 2026-11-19, the entry screen's voice line): how it compared with the
 * person's usual voice; that too few takes were heard yet to know what usual
 * is; or nothing — no recording, too little speech in it, nothing on this
 * phone to measure with.
 */
export type VoiceHeard =
  | { readonly kind: 'compared'; readonly cue: VoiceCue; readonly portrait: readonly VoiceScale[] }
  | { readonly kind: 'learning' }
  | { readonly kind: 'silent' };

/** Fewer takes than this and "usual" would be a guess. */
export const ENOUGH_USUAL = 5;

/** The five things a voice is compared on, in the order they are shown. */
export type VoiceMeasure = 'loudness' | 'pitch' | 'liveliness' | 'pace' | 'pauses';

/**
 * One measure of a take against the person's usual voice, for the voice
 * portrait (owner's word, 2026-11-19): how far from their usual middle it
 * sits, in spreads of their own voice — negative is less, positive more —
 * and how far either side still counts as usual. Never a number on screen;
 * a place on a line beside a band.
 */
export interface VoiceScale {
  readonly measure: VoiceMeasure;
  readonly away: number;
  readonly usualWithin: number;
  /** The mark this take earned on the measure, or null when it sat within the usual band. */
  readonly mark: VoiceMark | null;
}

interface Measure {
  readonly measure: VoiceMeasure;
  readonly read: (reading: VoiceReading) => number | null;
  /** The smallest spread worth trusting, so a very steady voice does not mark every wobble. */
  readonly floor: number;
  /** How many spreads from usual a take must sit to be marked. */
  readonly beyond: number;
  readonly below: VoiceMark;
  readonly above: VoiceMark;
}

/*
 * Loudness asks for more: it moves with how far the phone was held as much
 * as with the voice. Brightness is left out for the same reason, more so.
 */
const MEASURES: readonly Measure[] = [
  { measure: 'loudness', read: (r) => r.loudnessDb, floor: 3, beyond: 1.5, below: 'quieter', above: 'louder' },
  {
    measure: 'pitch',
    read: (r) => (r.pitchHz === null ? null : 12 * Math.log2(r.pitchHz)),
    floor: 1,
    beyond: 1,
    below: 'lower',
    above: 'higher',
  },
  {
    measure: 'liveliness',
    read: (r) => r.pitchRangeSemitones,
    floor: 1,
    beyond: 1,
    below: 'flatter',
    above: 'livelier',
  },
  { measure: 'pace', read: (r) => r.pace, floor: 0.3, beyond: 1, below: 'slower', above: 'faster' },
  {
    measure: 'pauses',
    read: (r) => r.pauseShare,
    floor: 0.05,
    beyond: 1,
    below: 'fewer pauses',
    above: 'more pauses',
  },
];

/**
 * Where a take stands against the person's usual voice, or null when there is
 * not yet enough of it to say: the take held too little speech, or fewer than
 * a handful of earlier takes were heard.
 */
export function compareVoice(take: VoiceReading, usual: readonly VoiceReading[]): VoiceCue | null {
  const portrait = voicePortrait(take, usual);

  return portrait === null
    ? null
    : { marks: portrait.flatMap((scale) => (scale.mark === null ? [] : [scale.mark])) };
}

/**
 * The same comparison, measure by measure, for the voice portrait — so the
 * line under the player and the scales behind it can never disagree. Null
 * exactly when `compareVoice` is; a measure the take or the usual voice lacks
 * is left out.
 */
export function voicePortrait(take: VoiceReading, usual: readonly VoiceReading[]): readonly VoiceScale[] | null {
  const heard = usual.filter((reading) => reading.heard);

  if (!take.heard || heard.length < ENOUGH_USUAL) {
    return null;
  }

  return MEASURES.flatMap((measure) => {
    const value = measure.read(take);
    const values = heard.map(measure.read).filter((v): v is number => v !== null);

    if (value === null || values.length < ENOUGH_USUAL) {
      return [];
    }

    const middle = median(values);
    // The median distance from the middle, scaled to read like a standard deviation.
    const spread = Math.max(1.4826 * median(values.map((v) => Math.abs(v - middle))), measure.floor);
    const away = (value - middle) / spread;
    const mark = away <= -measure.beyond ? measure.below : away >= measure.beyond ? measure.above : null;

    return [{ measure: measure.measure, away, usualWithin: measure.beyond, mark }];
  });
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
