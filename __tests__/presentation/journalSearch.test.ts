import { SearchQuery } from '@/domain/value-objects/SearchQuery';
import { piecesOf, snippetOf } from '@/presentation/screens/journalSearch';

function query(typed: string): SearchQuery {
  const parsed = SearchQuery.of(typed);

  if (parsed === null) {
    throw new Error('nothing to search');
  }

  return parsed;
}

function lit(pieces: readonly { readonly text: string; readonly found: boolean }[]): string {
  return pieces.map((piece) => (piece.found ? `[${piece.text}]` : piece.text)).join('');
}

describe('journal search snippets', () => {
  it('cuts a text into plain and lit pieces', () => {
    expect(piecesOf('a meeting today', [{ start: 2, end: 9 }])).toEqual([
      { text: 'a ', found: false },
      { text: 'meeting', found: true },
      { text: ' today', found: false },
    ]);
  });

  it('shows the whole text when the word is in its first sentence', () => {
    expect(lit(snippetOf('An important meeting tomorrow. Then rest.', query('meet')))).toBe(
      'An important [meeting] tomorrow. Then rest.',
    );
  });

  it('starts at the sentence the word is in, behind an ellipsis', () => {
    expect(lit(snippetOf('A long quiet day at home. Tomorrow a meeting.', query('meet')))).toBe(
      '…Tomorrow a [meeting].',
    );
  });

  it('comes close to a word deep in a long sentence', () => {
    const text =
      'Walked for a long time along the river and then back through the old park past the fountain to finally reach the meeting point.';
    const shown = lit(snippetOf(text, query('meeting')));

    expect(shown.startsWith('…')).toBe(true);
    expect(shown).toContain('[meeting]');
    expect(shown.length).toBeLessThan(text.length);
  });

  it('lights every found word in the snippet', () => {
    expect(lit(snippetOf('Meeting moved; the meeting is Friday.', query('meet')))).toBe(
      '[Meeting] moved; the [meeting] is Friday.',
    );
  });

  it('shows the text as it is when the word is not in it', () => {
    expect(snippetOf('A quiet evening.', query('walk'))).toEqual([{ text: 'A quiet evening.', found: false }]);
  });
});
