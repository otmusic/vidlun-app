import { VoiceReading } from '@/domain/value-objects/VoiceReading';

const MEASURED = {
  version: 1,
  speechMs: 8700,
  pitchHz: 100.7,
  pitchRangeSemitones: 6.2,
  loudnessDb: -19.5,
  loudnessRangeDb: 19.4,
  pauseShare: 0.126,
  pace: 2.0,
  brightnessHz: 395.5,
};

describe('a voice reading', () => {
  it('keeps every measure the phone took', () => {
    expect(VoiceReading.from(MEASURED)?.toJSON()).toEqual(MEASURED);
  });

  it('holds a take with too little speech as heard nothing, with no measures', () => {
    const reading = VoiceReading.from({ version: 1, speechMs: 120 });

    expect(reading?.heard).toBe(false);
    expect(reading?.pitchHz).toBeNull();
    expect(reading?.pace).toBeNull();
  });

  it('reads a number that is not finite, or a pitch below zero, as a measure not taken', () => {
    const reading = VoiceReading.from({ ...MEASURED, pitchHz: -3, pace: Number.NaN, loudnessDb: 'loud' });

    expect(reading?.pitchHz).toBeNull();
    expect(reading?.pace).toBeNull();
    expect(reading?.loudnessDb).toBeNull();
  });

  it('keeps the pause share between none and all', () => {
    expect(VoiceReading.from({ ...MEASURED, pauseShare: 1.4 })?.pauseShare).toBe(1);
  });

  it('is not a reading without a version or the length of speech', () => {
    expect(VoiceReading.from({ speechMs: 100 })).toBeNull();
    expect(VoiceReading.from({ version: 1 })).toBeNull();
    expect(VoiceReading.from({ version: 1, speechMs: -1 })).toBeNull();
    expect(VoiceReading.from('loud')).toBeNull();
    expect(VoiceReading.from(null)).toBeNull();
  });

  it('calls a reading from an older analysis stale, so it is measured again', () => {
    expect(VoiceReading.from({ ...MEASURED, version: 0 })?.stale).toBe(true);
    expect(VoiceReading.from(MEASURED)?.stale).toBe(false);
  });
});
