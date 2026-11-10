/** One shape's place: its top-left corner, its size and how far it leans. */
export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** Degrees, either way. */
  readonly turn: number;
}

/** Room left between two shapes, so none of them touch. */
const GAP = 8;
const MAX_SIZE = 168;
const MIN_SIZE = 64;
/** How much of the room the shapes may take, as the side of a square each. */
const FILL = 0.74;
const LEAN = 14;
/** How far a shape may wander from its place, as a share of its size. */
const WANDER = 0.16;
const WANDER_TRIES = 16;

/**
 * Where the five sit, before they wander: each a point in the room, 0 to 1
 * across and down, where 0 puts the shape against the left or top edge and 1
 * against the right or bottom. Every layout spans the whole room and weighs
 * the same on both sides (owner's word, 2026-11-10: thrown at random they
 * gathered on one side).
 */
const LAYOUTS: readonly (readonly (readonly [number, number])[])[] = [
  // A zigzag down the page, starting left.
  [
    [0, 0],
    [1, 0.25],
    [0.05, 0.5],
    [1, 0.75],
    [0, 1],
  ],
  // The same, starting right.
  [
    [1, 0],
    [0, 0.25],
    [0.95, 0.5],
    [0, 0.75],
    [1, 1],
  ],
  // Two, one in the middle, two.
  [
    [0, 0],
    [1, 0.08],
    [0.5, 0.5],
    [0, 0.92],
    [1, 1],
  ],
  // One on top, then two and two.
  [
    [0.5, 0],
    [0, 0.38],
    [1, 0.46],
    [0.1, 0.92],
    [0.9, 1],
  ],
  // Two and two, then one at the bottom.
  [
    [0.1, 0],
    [0.9, 0.08],
    [0, 0.54],
    [1, 0.62],
    [0.5, 1],
  ],
];

/**
 * Five shapes laid out across the whole room in one of a few balanced
 * layouts, picked at random, each then wandering a little from its place,
 * a little smaller or larger than the next and leaning, so it reads as a
 * handful thrown down rather than a grid, never all to one side, and never
 * two touching. They are as big as the room lets the layout make them.
 */
export function scatter(count: number, width: number, height: number, random: () => number): readonly Spot[] {
  const layout = LAYOUTS[Math.floor(random() * LAYOUTS.length)] ?? LAYOUTS[0]!;

  if (layout.length < count) {
    return zigzag(count, width, height, random);
  }

  const size = largestThatFits(layout.slice(0, count), width, height);

  if (size === null) {
    return zigzag(count, width, height, random);
  }

  const placed: Spot[] = layout.slice(0, count).map(([across, down]) => {
    // Only ever smaller than the size the layout was fitted at, so it still fits.
    const own = size * (0.9 + random() * 0.1);
    const center = centerOf(across, down, size, width, height);

    return { x: center.x - own / 2, y: center.y - own / 2, size: own, turn: (random() * 2 - 1) * LEAN };
  });

  return placed.map((spot, at) => wander(spot, at, placed, width, height, random));
}

/** The point a layout names, for a shape of this size, kept inside the room. */
function centerOf(across: number, down: number, size: number, width: number, height: number): { x: number; y: number } {
  return {
    x: size / 2 + across * (width - size),
    y: size / 2 + down * (height - size),
  };
}

function largestThatFits(
  layout: readonly (readonly [number, number])[],
  width: number,
  height: number,
): number | null {
  let size = Math.min(MAX_SIZE, width * 0.46, Math.sqrt((width * height) / layout.length) * FILL);

  while (size >= MIN_SIZE) {
    if (size <= width && size <= height) {
      const spots = layout.map(([across, down]) => {
        const center = centerOf(across, down, size, width, height);

        return { x: center.x - size / 2, y: center.y - size / 2, size, turn: 0 };
      });

      if (spots.every((one, at) => spots.slice(at + 1).every((other) => apart(one, other)))) {
        return size;
      }
    }

    size *= 0.95;
  }

  return null;
}

/** A little way from its place, if the others leave room there; otherwise where it was. */
function wander(
  spot: Spot,
  at: number,
  placed: Spot[],
  width: number,
  height: number,
  random: () => number,
): Spot {
  const reach = spot.size * WANDER;

  for (let attempt = 0; attempt < WANDER_TRIES; attempt += 1) {
    const moved: Spot = {
      ...spot,
      x: clamp(spot.x + (random() * 2 - 1) * reach, 0, width - spot.size),
      y: clamp(spot.y + (random() * 2 - 1) * reach, 0, height - spot.size),
    };

    if (placed.every((other, index) => index === at || apart(moved, other))) {
      placed[at] = moved;

      return moved;
    }
  }

  return spot;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/** Far enough apart as circles, with the gap between them. */
export function apart(one: Spot, other: Spot): boolean {
  const distance = Math.hypot(
    one.x + one.size / 2 - (other.x + other.size / 2),
    one.y + one.size / 2 - (other.y + other.size / 2),
  );

  return distance >= one.size / 2 + other.size / 2 + GAP;
}

/** For a room too small for any layout: two columns, top to bottom. */
function zigzag(count: number, width: number, height: number, random: () => number): readonly Spot[] {
  const rows = Math.ceil(count / 2);
  const size = Math.max(1, Math.min(width / 2 - GAP, height / rows - GAP));

  return Array.from({ length: count }, (_none, at) => ({
    x: at % 2 === 0 ? 0 : width - size,
    y: Math.floor(at / 2) * (size + GAP),
    size,
    turn: (random() * 2 - 1) * LEAN,
  }));
}
