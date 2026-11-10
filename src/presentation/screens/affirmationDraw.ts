/**
 * Five different affirmations from the list, in the order a shuffle leaves
 * them, or every one there is when the list is shorter. The random source is
 * passed in so a draw can be checked; the screen hands it Math.random.
 */
export function drawCards<T>(pool: readonly T[], count: number, random: () => number): readonly T[] {
  const left = [...pool];
  const drawn: T[] = [];

  while (drawn.length < count && left.length > 0) {
    const at = Math.min(left.length - 1, Math.floor(random() * left.length));
    const [card] = left.splice(at, 1);

    if (card !== undefined) {
      drawn.push(card);
    }
  }

  return drawn;
}
