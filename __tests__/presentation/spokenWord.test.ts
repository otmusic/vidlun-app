import { transcriptPieces, wordAt } from '@/presentation/screens/spokenWord';

const TEXT = 'Long day, calm evening.';

function word(text: string, share: number): string | null {
  const found = wordAt(text, share);

  return found === null ? null : text.slice(found.start, found.end);
}

describe('the word being said', () => {
  it('is the word at that share of the text', () => {
    expect(word(TEXT, 0)).toBe('Long');
    expect(word(TEXT, 0.3)).toBe('day');
    expect(word(TEXT, 0.5)).toBe('calm');
    expect(word(TEXT, 1)).toBe('evening');
  });

  it('keeps the word before when the share lands between words', () => {
    // Index 9 is the space after "day,".
    expect(word(TEXT, 9 / TEXT.length)).toBe('day');
  });

  it('reads Ukrainian words with their apostrophes whole', () => {
    // "Sim'ia vdoma" in Cyrillic, escaped: the codebase holds no Cyrillic.
    const family = '\u0421\u0456\u043c\u2019\u044f';

    expect(word(`${family} \u0432\u0434\u043e\u043c\u0430`, 0.1)).toBe(family);
  });

  it('is nothing for text without words', () => {
    expect(wordAt('…', 0.5)).toBeNull();
    expect(wordAt('', 0.5)).toBeNull();
  });
});

describe('the transcript cut for lighting', () => {
  it('lights the word being said and leaves the rest plain', () => {
    expect(transcriptPieces(TEXT, [], { start: 5, end: 8 })).toEqual([
      { text: 'Long ', found: false, spoken: false },
      { text: 'day', found: false, spoken: true },
      { text: ', calm evening.', found: false, spoken: false },
    ]);
  });

  it('keeps a searched word lit beside the one being said', () => {
    expect(transcriptPieces(TEXT, [{ start: 10, end: 14 }], { start: 0, end: 4 })).toEqual([
      { text: 'Long', found: false, spoken: true },
      { text: ' day, ', found: false, spoken: false },
      { text: 'calm', found: true, spoken: false },
      { text: ' evening.', found: false, spoken: false },
    ]);
  });

  it('marks a searched word being said as both', () => {
    expect(transcriptPieces(TEXT, [{ start: 10, end: 14 }], { start: 10, end: 14 })[1]).toEqual({
      text: 'calm',
      found: true,
      spoken: true,
    });
  });

  it('is the text whole when nothing is lit', () => {
    expect(transcriptPieces(TEXT, [], null)).toEqual([{ text: TEXT, found: false, spoken: false }]);
  });
});
