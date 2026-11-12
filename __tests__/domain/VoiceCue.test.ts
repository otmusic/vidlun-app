import { compareVoice, ENOUGH_USUAL } from '@/domain/value-objects/VoiceCue';
import { VoiceReading } from '@/domain/value-objects/VoiceReading';

/** A take of this person's, with the measures given and the rest at their usual. */
function take(measures: Partial<Record<string, number | null>> = {}): VoiceReading {
  const reading = VoiceReading.from({
    version: VoiceReading.VERSION,
    speechMs: 9000,
    pitchHz: 180,
    pitchRangeSemitones: 8,
    loudnessDb: -20,
    loudnessRangeDb: 18,
    pauseShare: 0.1,
    pace: 2.5,
    brightnessHz: 500,
    ...measures,
  });

  if (reading === null) {
    throw new Error('not a reading');
  }

  return reading;
}

/** Ten ordinary takes, each a little off the middle, as a real voice is. */
const USUAL = [-1, 1, -0.5, 0.5, 0, -1, 1, -0.5, 0.5, 0].map((wobble) =>
  take({
    pitchHz: 180 * 2 ** (wobble / 24),
    pitchRangeSemitones: 8 + wobble * 0.5,
    loudnessDb: -20 + wobble,
    pace: 2.5 + wobble * 0.1,
    pauseShare: 0.1 + wobble * 0.02,
  }),
);

describe('a voice against its usual self', () => {
  it('marks nothing when the take sounds as the person usually does', () => {
    expect(compareVoice(take(), USUAL)).toEqual({ marks: [] });
  });

  it('marks a quiet, flat, slow take with long pauses', () => {
    const cue = compareVoice(
      take({ loudnessDb: -32, pitchRangeSemitones: 4, pace: 1.6, pauseShare: 0.3 }),
      USUAL,
    );

    expect(cue?.marks).toEqual(['quieter', 'flatter', 'slower', 'more pauses']);
  });

  it('marks a high, lively, fast take', () => {
    const cue = compareVoice(take({ pitchHz: 230, pitchRangeSemitones: 12, pace: 3.4 }), USUAL);

    expect(cue?.marks).toEqual(['higher', 'livelier', 'faster']);
  });

  it('asks more of loudness, which moves with how the phone was held', () => {
    // Two decibels under, with the spread floored at three: not enough to say.
    expect(compareVoice(take({ loudnessDb: -24 }), USUAL)?.marks).toEqual([]);
  });

  it('says nothing until there are enough earlier takes to know what usual is', () => {
    expect(compareVoice(take(), USUAL.slice(0, ENOUGH_USUAL - 1))).toBeNull();
  });

  it('says nothing about a take with too little speech in it', () => {
    const silent = VoiceReading.from({ version: VoiceReading.VERSION, speechMs: 200 });

    expect(silent === null ? 'none' : compareVoice(silent, USUAL)).toBeNull();
  });

  it('leaves out a measure the take could not hold', () => {
    expect(compareVoice(take({ pitchHz: null, pitchRangeSemitones: null }), USUAL)?.marks).toEqual([]);
  });
});
