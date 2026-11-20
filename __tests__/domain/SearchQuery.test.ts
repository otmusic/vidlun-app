import { SearchQuery } from '@/domain/value-objects/SearchQuery';

/** A Ukrainian stem and a longer form of it, written in escapes to keep the source in English. */
const MEETING_STEM = '\u0437\u0443\u0441\u0442\u0440\u0456\u0447';
const MEETINGS = '\u0437\u0443\u0441\u0442\u0440\u0456\u0447\u0456';

function query(typed: string): SearchQuery {
  const parsed = SearchQuery.of(typed);

  if (parsed === null) {
    throw new Error(`nothing searchable in "${typed}"`);
  }

  return parsed;
}

describe('SearchQuery', () => {
  it('has nothing to search when only spaces and punctuation were typed', () => {
    expect(SearchQuery.of('')).toBeNull();
    expect(SearchQuery.of('   ')).toBeNull();
    expect(SearchQuery.of(' , . ! ')).toBeNull();
  });

  it('finds a word by its beginning, so a stem finds its endings', () => {
    expect(query('meet').matches('An important meeting tomorrow.')).toBe(true);
    expect(query(MEETING_STEM).matches(`Tomorrow ${MEETINGS} at nine.`)).toBe(true);
  });

  it('does not find letters in the middle of a word', () => {
    expect(query('eting').matches('An important meeting tomorrow.')).toBe(false);
  });

  it('pays no attention to case', () => {
    expect(query('MEET').matches('a meeting')).toBe(true);
    expect(query('meet').matches('MEETING')).toBe(true);
  });

  it('reads the apostrophes people type as one', () => {
    expect(query('don’t').matches("I don't know")).toBe(true);
    expect(query("don't").matches('I donʼt know')).toBe(true);
  });

  it('reads the Russian yo as ye', () => {
    expect(query('\u0435\u0449\u0435').matches('\u0435\u0449\u0451 \u0440\u0430\u0437')).toBe(true);
  });

  it('needs every typed word to be there', () => {
    expect(query('long meeting').matches('A long day, then a meeting.')).toBe(true);
    expect(query('long walk').matches('A long day, then a meeting.')).toBe(false);
  });

  it('marks the whole word each typed word begins, in the order they come', () => {
    const text = 'Meeting moved; the meeting is Friday.';

    expect(query('meet').matchesIn(text)).toEqual([
      { start: 0, end: 7 },
      { start: 19, end: 26 },
    ]);
    expect(query('meet').firstIn(text)).toEqual({ start: 0, end: 7 });
  });

  it('keeps places in the original text when words are separated by punctuation', () => {
    const text = '«Walk» — then rest…';
    const found = query('rest').firstIn(text);

    expect(found).not.toBeNull();
    expect(text.slice(found?.start, found?.end)).toBe('rest');
  });

  it('finds nothing in a text without the word', () => {
    expect(query('walk').firstIn('A quiet evening.')).toBeNull();
  });
});
