import { isEmotionDepth, MAX_EMOTION_DEPTH } from '@/domain/value-objects/EmotionDepth';

describe('emotion depth', () => {
  it('recognises the three levels of the wheel', () => {
    expect([1, 2, 3].every(isEmotionDepth)).toBe(true);
  });

  it.each([0, 4, -1, 2.5])('rejects %p', (value) => {
    expect(isEmotionDepth(value)).toBe(false);
  });

  it('stops at three levels', () => {
    expect(MAX_EMOTION_DEPTH).toBe(3);
  });
});
