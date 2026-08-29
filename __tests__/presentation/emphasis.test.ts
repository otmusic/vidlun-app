import { runsOf } from '@/presentation/screens/emphasis';

describe('runsOf', () => {
  it('leaves a plain sentence alone', () => {
    expect(runsOf('No account is needed.')).toEqual([
      { text: 'No account is needed.', strong: false },
    ]);
  });

  it('lifts the part being insisted on out of the sentence', () => {
    expect(runsOf('Audio *never leaves* your phone.')).toEqual([
      { text: 'Audio ', strong: false },
      { text: 'never leaves', strong: true },
      { text: ' your phone.', strong: false },
    ]);
  });

  it('reads a whole sentence set in emphasis', () => {
    expect(runsOf('*Vidlun does not diagnose.*')).toEqual([
      { text: 'Vidlun does not diagnose.', strong: true },
    ]);
  });

  it('keeps a lone asterisk as the character it is', () => {
    // Losing a character out of a legal document to a parser is worse than
    // showing an asterisk nobody meant.
    expect(runsOf('Cancel any time*')).toEqual([{ text: 'Cancel any time*', strong: false }]);
  });
});
