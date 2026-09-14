import { engineFor } from '@/domain/speech/SpeechEngine';

describe('which engine reads a take', () => {
  it('lets the phone read English by itself where it can', () => {
    expect(engineFor('en', true)).toBe('apple');
  });

  it('keeps Ukrainian on the model, which is the only thing that knows it', () => {
    expect(engineFor('uk', true)).toBe('vidlun');
  });

  it('falls back to the model for English on a phone that cannot read it alone', () => {
    expect(engineFor('en', false)).toBe('vidlun');
  });
});
