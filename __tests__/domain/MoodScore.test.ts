import { InvalidMoodScoreError } from '@/domain/errors/ValueObjectErrors';
import { MoodScore } from '@/domain/value-objects/MoodScore';

describe('MoodScore', () => {
  it('accepts every point on the five-point scale', () => {
    expect([1, 2, 3, 4, 5].map((value) => MoodScore.of(value).value)).toEqual([1, 2, 3, 4, 5]);
  });

  it.each([0, 6, -1, 3.5, Number.NaN])('rejects %p as a stored score', (value) => {
    expect(() => MoodScore.of(value)).toThrow(InvalidMoodScoreError);
  });

  it('pulls model output back into range instead of failing the entry', () => {
    expect(MoodScore.clamped(9).value).toBe(5);
    expect(MoodScore.clamped(-2).value).toBe(1);
  });

  it('rounds a fractional model score to the nearest point', () => {
    expect(MoodScore.clamped(3.4).value).toBe(3);
    expect(MoodScore.clamped(3.6).value).toBe(4);
  });

  it('falls back to the middle of the scale when the model returns nothing usable', () => {
    expect(MoodScore.clamped(Number.NaN).value).toBe(3);
  });

  it('compares by value, not identity', () => {
    expect(MoodScore.of(4).equals(MoodScore.of(4))).toBe(true);
    expect(MoodScore.of(4).equals(MoodScore.of(2))).toBe(false);
  });
});
