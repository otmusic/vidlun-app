import type { TextStyle } from 'react-native';

/** The edges of a text box that decide where its bottom lands. */
export type BottomEdges = Pick<
  TextStyle,
  'padding' | 'paddingVertical' | 'paddingBottom' | 'margin' | 'marginVertical' | 'marginBottom'
>;

/**
 * A hundredth of a point, off the pixel grid at every screen scale.
 *
 * iOS draws a paragraph into a TextKit box exactly the size of the view's
 * frame and keeps only the lines that fit whole. Yoga computes that frame's
 * height as the difference of two edges it has rounded to the pixel grid and
 * stored as float32, so a box that sits a third of a point off the grid and
 * straddles a power of two (1024, 2048, ...) can come out a ten-thousandth of
 * a point short: 68.99988 for three 23-point lines. TextKit then fits one line
 * fewer and clips the rest of the paragraph onto the last line that did fit,
 * which is how the 11 September card in the seeded journal lost its third line.
 * A text box whose height is off the grid is one Yoga rounds up instead, which
 * leaves it a third of a point of room no float error can take away.
 *
 * Until React Native fixes the rounding (facebook/react-native#53450).
 */
const SLACK = 0.01;

/**
 * The bottom padding and margin that give a text box that room, added to
 * whatever the text was given itself. The margin takes the padding back, so
 * the box claims the same space in its parent as before and nothing around it
 * moves. A margin it cannot count with, such as `auto`, is left to the layout;
 * a padding it cannot count with leaves the box alone.
 */
export function textSlack(style: BottomEdges): Pick<TextStyle, 'paddingBottom' | 'marginBottom'> {
  const padding = style.paddingBottom ?? style.paddingVertical ?? style.padding ?? 0;
  const margin = style.marginBottom ?? style.marginVertical ?? style.margin ?? 0;

  if (typeof padding !== 'number') {
    return {};
  }

  return typeof margin === 'number'
    ? { paddingBottom: padding + SLACK, marginBottom: margin - SLACK }
    : { paddingBottom: padding + SLACK };
}
