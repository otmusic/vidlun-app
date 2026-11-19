import { COLUMN_MAX_WIDTH, columnMargin, columnSides, columnSurface } from '@/presentation/theme/column';

const NO_INSETS = { left: 0, right: 0 };
/** The open iPhone Duo as its simulator reports it: 951pt across, the status bar down the right side. */
const DUO_OPEN = 951;
const DUO_STATUS_SIDE = { left: 0, right: 45 };

describe('the content column', () => {
  it('leaves a phone exactly as drawn', () => {
    expect(columnMargin(402)).toBe(0);
    expect(columnSides(402, NO_INSETS)).toEqual({ left: 0, right: 0 });
    // The closed Duo: its side status bar still pushes the content in, as before.
    expect(columnSides(466, DUO_STATUS_SIDE)).toEqual({ left: 0, right: 45 });
  });

  it('stands in the middle of a wide window, at its own width', () => {
    const sides = columnSides(DUO_OPEN, NO_INSETS);

    expect(sides.left).toBe(sides.right);
    expect(DUO_OPEN - sides.left - sides.right).toBeCloseTo(COLUMN_MAX_WIDTH, -1);
  });

  it('takes the side status bar into the margin instead of adding it on top', () => {
    const sides = columnSides(DUO_OPEN, DUO_STATUS_SIDE);

    // Still centred: the margin is wider than the status bar it covers.
    expect(sides.right).toBe(sides.left);
    expect(sides.right).toBe(columnMargin(DUO_OPEN));
  });

  it('lets a safe area wider than the margin push the content in on its side only', () => {
    expect(columnSides(640, { left: 0, right: 60 })).toEqual({ left: 20, right: 60 });
  });

  it('makes a sheet the column, with the drawn padding inside it', () => {
    const margin = columnMargin(DUO_OPEN);

    expect(columnSurface(DUO_OPEN, DUO_STATUS_SIDE, 20)).toEqual({
      marginLeft: margin,
      marginRight: margin,
      paddingLeft: 20,
      paddingRight: 20,
    });
  });

  it('keeps a phone sheet edge to edge, with the side safe area inside it', () => {
    expect(columnSurface(466, DUO_STATUS_SIDE, 20)).toEqual({
      marginLeft: 0,
      marginRight: 0,
      paddingLeft: 20,
      paddingRight: 65,
    });
  });
});
