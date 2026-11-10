import { apart, scatter } from '@/presentation/screens/affirmationScatter';

/** The same throw every run, so a failure can be looked at. */
function seeded(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

describe('scatter', () => {
  // The room the page leaves on an iPhone 17 and on an SE.
  const ROOMS = [
    { name: 'a large phone', width: 358, height: 560 },
    { name: 'a small phone', width: 331, height: 330 },
  ];

  it.each(ROOMS)('throws five that fit inside the room on $name', ({ width, height }) => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const spots = scatter(5, width, height, seeded(seed));

      expect(spots).toHaveLength(5);
      for (const spot of spots) {
        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x + spot.size).toBeLessThanOrEqual(width + 0.001);
        expect(spot.y + spot.size).toBeLessThanOrEqual(height + 0.001);
      }
    }
  });

  it.each(ROOMS)('never lets two touch on $name', ({ width, height }) => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const spots = scatter(5, width, height, seeded(seed));

      spots.forEach((one, at) => {
        spots.slice(at + 1).forEach((other) => {
          expect(apart(one, other)).toBe(true);
        });
      });
    }
  });

  it('makes them bigger than the old row of three on a large phone', () => {
    const spots = scatter(5, 358, 560, seeded(7));

    // The row of three drew them at 110 points at most.
    expect(Math.min(...spots.map((spot) => spot.size))).toBeGreaterThan(110);
  });

  /*
   * Owner's word, 2026-11-10: thrown at random, the five gathered on one
   * side. Their middle stays near the room's middle, both ways.
   */
  it.each(ROOMS)('keeps the five balanced across and down the room on $name', ({ width, height }) => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const spots = scatter(5, width, height, seeded(seed));
      const middleX = spots.reduce((sum, spot) => sum + spot.x + spot.size / 2, 0) / spots.length;
      const middleY = spots.reduce((sum, spot) => sum + spot.y + spot.size / 2, 0) / spots.length;

      expect(Math.abs(middleX - width / 2)).toBeLessThan(width * 0.15);
      expect(Math.abs(middleY - height / 2)).toBeLessThan(height * 0.1);
    }
  });

  it.each(ROOMS)('reaches from the top of the room to the bottom on $name', ({ width, height }) => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const spots = scatter(5, width, height, seeded(seed));

      expect(Math.min(...spots.map((spot) => spot.y))).toBeLessThan(height * 0.1);
      expect(Math.max(...spots.map((spot) => spot.y + spot.size))).toBeGreaterThan(height * 0.9);
    }
  });

  it('throws a different set each time', () => {
    expect(scatter(5, 358, 560, seeded(1))).not.toEqual(scatter(5, 358, 560, seeded(2)));
  });

  it('still gives five in a room too small to throw into', () => {
    expect(scatter(5, 120, 90, seeded(3))).toHaveLength(5);
  });
});
