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

/** Fewer takes than this and "usual" would be a guess. */
export const ENOUGH_USUAL = 5;

interface Measure {
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
  { read: (r) => r.loudnessDb, floor: 3, beyond: 1.5, below: 'quieter', above: 'louder' },
  {
    read: (r) => (r.pitchHz === null ? null : 12 * Math.log2(r.pitchHz)),
    floor: 1,
    beyond: 1,
    below: 'lower',
    above: 'higher',
  },
  { read: (r) => r.pitchRangeSemitones, floor: 1, beyond: 1, below: 'flatter', above: 'livelier' },
  { read: (r) => r.pace, floor: 0.3, beyond: 1, below: 'slower', above: 'faster' },
  { read: (r) => r.pauseShare, floor: 0.05, beyond: 1, below: 'fewer pauses', above: 'more pauses' },
];

/**
 * Where a take stands against the person's usual voice, or null when there is
 * not yet enough of it to say: the take held too little speech, or fewer than
 * a handful of earlier takes were heard.
 */
export function compareVoice(take: VoiceReading, usual: readonly VoiceReading[]): VoiceCue | null {
  const heard = usual.filter((reading) => reading.heard);

  if (!take.heard || heard.length < ENOUGH_USUAL) {
    return null;
  }

  const marks: VoiceMark[] = [];

  for (const measure of MEASURES) {
    const value = measure.read(take);
    const values = heard.map(measure.read).filter((v): v is number => v !== null);

    if (value === null || values.length < ENOUGH_USUAL) {
      continue;
    }

    const middle = median(values);
    // The median distance from the middle, scaled to read like a standard deviation.
    const spread = Math.max(1.4826 * median(values.map((v) => Math.abs(v - middle))), measure.floor);
    const away = (value - middle) / spread;

    if (away <= -measure.beyond) {
      marks.push(measure.below);
    } else if (away >= measure.beyond) {
      marks.push(measure.above);
    }
  }

  return { marks };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
