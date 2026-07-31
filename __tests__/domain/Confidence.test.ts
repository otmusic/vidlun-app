import { InvalidConfidenceError } from '@/domain/errors/ValueObjectErrors';
import { Confidence } from '@/domain/value-objects/Confidence';

describe('Confidence', () => {
  it('accepts the whole zero-to-one range', () => {
    expect(Confidence.of(0).value).toBe(0);
    expect(Confidence.of(1).value).toBe(1);
  });

  it.each([-0.01, 1.01, Number.NaN])('rejects %p', (value) => {
    expect(() => Confidence.of(value)).toThrow(InvalidConfidenceError);
  });

  it('pulls a speech-engine value back into range instead of failing capture', () => {
    expect(Confidence.clamped(1.4).value).toBe(1);
    expect(Confidence.clamped(-0.2).value).toBe(0);
    expect(Confidence.clamped(0.72).value).toBe(0.72);
  });

  it('treats an unusable value as knowing nothing about what it heard', () => {
    expect(Confidence.clamped(Number.NaN).level).toBe('low');
  });

  it.each([
    [0.95, 'high'],
    [0.8, 'high'],
    [0.79, 'medium'],
    [0.5, 'medium'],
    [0.49, 'low'],
    [0, 'low'],
  ])('reads %p as %s confidence', (value, level) => {
    expect(Confidence.of(value).level).toBe(level);
  });

  it('allows a specific emotion only when it is sure it heard correctly', () => {
    expect(Confidence.of(0.9).maxEmotionDepth).toBe(3);
    expect(Confidence.of(0.6).maxEmotionDepth).toBe(2);
    expect(Confidence.of(0.2).maxEmotionDepth).toBe(1);
  });

  it('asks the user to check a transcript it barely made out', () => {
    expect(Confidence.of(0.2).needsUserReview).toBe(true);
    expect(Confidence.of(0.6).needsUserReview).toBe(false);
  });

  it('compares by value, not identity', () => {
    expect(Confidence.of(0.7).equals(Confidence.of(0.7))).toBe(true);
    expect(Confidence.of(0.7).equals(Confidence.of(0.3))).toBe(false);
  });
});
