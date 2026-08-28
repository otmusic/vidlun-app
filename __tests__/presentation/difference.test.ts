import { differenceBetween } from '@/presentation/screens/difference';

describe('what the card says about two answers', () => {
  it('treats saying nothing as an answer, not as a wrong one', () => {
    expect(differenceBetween([], ['bad.tired'])).toEqual({ kind: 'silent' });
  });

  it('tells two silences apart, because only one of them has Vidlun beside it', () => {
    expect(differenceBetween([], [])).toEqual({ kind: 'quiet' });
    expect(differenceBetween([], ['bad.tired'])).toEqual({ kind: 'silent' });
  });

  it('says so plainly when both landed on the same word', () => {
    expect(differenceBetween(['bad.tired'], ['bad.tired'])).toEqual({ kind: 'same' });
  });

  it('names the one Vidlun heard on top', () => {
    expect(differenceBetween(['bad.tired'], ['bad.tired', 'happy.proud'])).toEqual({
      kind: 'more',
      word: 'happy.proud',
    });
  });

  it('names the one Vidlun missed, which is a finding and not a mistake', () => {
    expect(differenceBetween(['bad.tired', 'happy.proud'], ['bad.tired'])).toEqual({
      kind: 'missing',
      word: 'happy.proud',
    });
  });

  it('holds both up when the two answers simply differ', () => {
    expect(differenceBetween(['sad.lonely'], ['bad.tired'])).toEqual({
      kind: 'other',
      mine: 'sad.lonely',
      theirs: 'bad.tired',
    });
  });

  it('does not call an empty analysis a difference of words', () => {
    expect(differenceBetween(['bad.tired'], [])).toEqual({ kind: 'missing', word: 'bad.tired' });
  });

  it('ignores the order the words were named in', () => {
    expect(differenceBetween(['a', 'b'], ['b', 'a'])).toEqual({ kind: 'same' });
  });
});
