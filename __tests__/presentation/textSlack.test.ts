import { textSlack } from '@/presentation/components/textSlack';
import { createTypography, typeScaleCap, type Typography } from '@/presentation/theme/tokens';

/*
 * How a paragraph reaches the screen on iOS, modelled closely enough to catch
 * the frame coming out shorter than its text. Yoga rounds each edge of the
 * box to the pixel grid and keeps the result as a float32 (a port of
 * roundLayoutResultsToPixelGrid from the Yoga in React Native 0.86); TextKit
 * then sets the lines in a container exactly the size of the rounded frame
 * and keeps only the lines that fit whole.
 */

const YOGA_EPSILON = 0.0001;

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < YOGA_EPSILON;
}

function roundToPixelGrid(value: number, scale: number, forceCeil: boolean, forceFloor: boolean): number {
  const scaled = value * scale;
  const fraction = ((scaled % 1) + 1) % 1;
  const floor = scaled - fraction;

  if (near(fraction, 0)) {
    return Math.fround(floor / scale);
  }

  if (near(fraction, 1) || forceCeil) {
    return Math.fround((floor + 1) / scale);
  }

  if (forceFloor) {
    return Math.fround(floor / scale);
  }

  return Math.fround((floor + (fraction > 0.5 || near(fraction, 0.5) ? 1 : 0)) / scale);
}

interface Paragraph {
  /** Where the box starts, in points from the top of the surface, before rounding. */
  readonly top: number;
  readonly lines: number;
  /** One line as TextKit sets it: the style's line height times the text size. */
  readonly lineHeight: number;
  /** Pixels per point. */
  readonly scale: number;
}

interface Slack {
  readonly paddingBottom?: unknown;
  readonly marginBottom?: unknown;
}

function paddingOf(slack: Slack): number {
  return typeof slack.paddingBottom === 'number' ? Math.fround(slack.paddingBottom) : 0;
}

/** The text box's frame height after rounding: bottom edge minus top edge, both float32. */
function frameOf(paragraph: Paragraph, slack: Slack): number {
  const { top, lines, lineHeight, scale } = paragraph;
  // The measurement itself is already rounded up to the next pixel.
  const measured = Math.ceil(lines * lineHeight * scale) / scale;
  const height = Math.fround(Math.fround(measured) + paddingOf(slack));
  const fractional = !near(Math.round(height * scale), height * scale);
  const bottom = roundToPixelGrid(top + height, scale, fractional, !fractional);

  return Math.fround(bottom - roundToPixelGrid(top, scale, false, true));
}

function linesDrawn(paragraph: Paragraph, slack: Slack): number {
  const container = frameOf(paragraph, slack) - paddingOf(slack);
  let drawn = 0;

  while (drawn < paragraph.lines && (drawn + 1) * paragraph.lineHeight <= container) {
    drawn += 1;
  }

  return drawn;
}

/** React Native's text-size multipliers on iOS, from extra small to the largest accessibility size. */
const TEXT_SIZES = [0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571];

/** One line of every style at every text size, each held to its own cap, and the cards' 23-point transcript. */
function everyLineHeight(): readonly number[] {
  const typography = createTypography();
  const atEverySize = (lineHeight: number, cap: number) => TEXT_SIZES.map((size) => lineHeight * Math.min(size, cap));
  const styles = (Object.keys(typography) as (keyof Typography)[]).flatMap((variant) =>
    atEverySize(typography[variant].lineHeight, typeScaleCap[variant]),
  );

  return [...new Set([...styles, ...atEverySize(23, typeScaleCap.body)])];
}

/** Where a float32 loses a bit of precision, as far down the page as a year of entries reaches. */
const POWERS_OF_TWO = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];

/**
 * Box tops just below each power of two, at every ninth of a point: each phase
 * a top can take against the pixel grid, near enough for a one-line box to
 * straddle the boundary and far enough for a long one to start well before it.
 */
function topsAcrossPowersOfTwo(): readonly number[] {
  return POWERS_OF_TWO.flatMap((power) =>
    [1, 12].flatMap((points) => [...Array(9).keys()].map((ninth) => power - points - ninth / 9)),
  );
}

/** Paragraphs, across line heights, lengths, positions and both densities, that lose a line; up to `limit` of them. */
function paragraphsLosingLines(slack: Slack, limit: number): readonly Paragraph[] {
  const lineHeights = everyLineHeight();
  const tops = topsAcrossPowersOfTwo();
  const lost: Paragraph[] = [];

  for (const scale of [2, 3]) {
    for (const lineHeight of lineHeights) {
      for (const lines of [1, 2, 3, 8]) {
        for (const top of tops) {
          const paragraph = { top, lines, lineHeight, scale };

          if (linesDrawn(paragraph, slack) < lines) {
            lost.push(paragraph);
          }

          if (lost.length === limit) {
            return lost;
          }
        }
      }
    }
  }

  return lost;
}

describe('a paragraph on an iPhone', () => {
  // The 11 September card in the seeded journal as the simulator laid it out
  // on 2026-09-30: three 23-point lines in a box that starts a third of a
  // point off the grid at 2008.33 and ends past 2048.
  const eleventhOfSeptember: Paragraph = { top: 6025 / 3, lines: 3, lineHeight: 23, scale: 3 };

  it('comes out as short as the simulator reported when nothing pads it', () => {
    expect(frameOf(eleventhOfSeptember, {})).toBe(68.9998779296875);
    expect(linesDrawn(eleventhOfSeptember, {})).toBe(2);
  });

  it('draws all three lines of the 11 September card', () => {
    expect(linesDrawn(eleventhOfSeptember, textSlack({}))).toBe(3);
  });

  it('loses lines somewhere across the page when nothing pads the box', () => {
    expect(paragraphsLosingLines({}, 1)).toHaveLength(1);
  });

  it('draws every line wherever the box lands, at every text size and on both screen densities', () => {
    expect(paragraphsLosingLines(textSlack({}), 5)).toEqual([]);
  });

  it('takes no room from the boxes around it, so nothing else moves', () => {
    const slack = textSlack({});
    const padding = typeof slack.paddingBottom === 'number' ? slack.paddingBottom : 0;
    const margin = typeof slack.marginBottom === 'number' ? slack.marginBottom : 0;

    expect(padding).toBeGreaterThan(0);
    expect(padding + margin).toBeCloseTo(0, 10);
  });

  it('adds to a bottom padding and margin the text was given instead of replacing them', () => {
    const own = textSlack({ paddingBottom: 4, marginBottom: 26 });
    const vertical = textSlack({ paddingVertical: 2, marginVertical: 8 });
    const shorthand = textSlack({ padding: 6, margin: 10 });

    expect(own.paddingBottom).toBeCloseTo(4.01, 10);
    expect(own.marginBottom).toBeCloseTo(25.99, 10);
    expect(vertical.paddingBottom).toBeCloseTo(2.01, 10);
    expect(vertical.marginBottom).toBeCloseTo(7.99, 10);
    expect(shorthand.paddingBottom).toBeCloseTo(6.01, 10);
    expect(shorthand.marginBottom).toBeCloseTo(9.99, 10);
  });

  it('still pads a text whose margin is automatic, and leaves that margin to the layout', () => {
    const slack = textSlack({ marginBottom: 'auto' });

    expect(slack.paddingBottom).toBeCloseTo(0.01, 10);
    expect(slack.marginBottom).toBeUndefined();
  });

  it('leaves a percentage padding alone rather than guess what it adds up to', () => {
    expect(textSlack({ paddingBottom: '10%' })).toEqual({});
  });
});
