import { keyOf, spansFrom } from '@/infrastructure/voice/NativeVoiceMontage';

jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));

const timing = { gapMs: 700, fadeInMs: 80, fadeOutMs: 600 };
const piece = { uri: 'file:///a.m4a', fromMs: 0, toMs: 10_000, fadeOut: true };

describe('NativeVoiceMontage', () => {
  it('reads where each piece landed, and a piece that could not be read as none', () => {
    expect(
      spansFrom(
        [
          [0, 10_000],
          [-1, -1],
          [10_700, 14_000],
        ],
        3,
      ),
    ).toEqual([{ startMs: 0, endMs: 10_000 }, null, { startMs: 10_700, endMs: 14_000 }]);
  });

  it('trusts nothing that is not one pair a piece', () => {
    expect(spansFrom('done', 1)).toBeNull();
    expect(spansFrom([[0, 1]], 2)).toBeNull();
    expect(spansFrom([['0', 1]], 1)).toEqual([null]);
  });

  it('names a joined file after what is in it', () => {
    expect(keyOf([piece], timing)).toBe(keyOf([{ ...piece }], { ...timing }));
    expect(keyOf([piece], timing)).not.toBe(keyOf([{ ...piece, toMs: 9_000 }], timing));
    expect(keyOf([piece], timing)).toMatch(/^month-[0-9a-z]+-1$/);
  });
});
