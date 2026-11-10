import { drawCards } from '@/presentation/screens/affirmationDraw';

/** A random source that walks a fixed list, so a draw can be checked. */
function sequence(values: readonly number[]): () => number {
  let at = 0;

  return () => {
    const value = values[at % values.length] ?? 0;

    at += 1;

    return value;
  };
}

describe('the five cards an affirmation is picked from', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('deals five different affirmations from the list', () => {
    const cards = drawCards(pool, 5, Math.random);

    expect(cards).toHaveLength(5);
    expect(new Set(cards).size).toBe(5);
    expect(cards.every((card) => pool.includes(card))).toBe(true);
  });

  it('deals what the random source says, so a draw is not always the same five', () => {
    expect(drawCards(pool, 5, sequence([0]))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(drawCards(pool, 5, sequence([0.99]))).toEqual(['h', 'g', 'f', 'e', 'd']);
  });

  it('deals every affirmation there is when the list is shorter than five', () => {
    expect([...drawCards(['a', 'b'], 5, Math.random)].sort()).toEqual(['a', 'b']);
  });
});
