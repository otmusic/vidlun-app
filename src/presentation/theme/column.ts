/**
 * The widest the content runs (owner's word, 2026-11-18). A phone's window is
 * narrower and nothing changes there. On a wide window — the open iPhone Duo
 * is 951pt across — the phone layout stands in a column this wide in the
 * middle instead of stretching edge to edge: the drawing as it was drawn,
 * since the design has no wide layout of its own yet. Backgrounds still fill
 * the window; only what sits on them keeps to the column.
 */
export const COLUMN_MAX_WIDTH = 600;

/** The safe area at a window's two sides. */
export interface SideInsets {
  readonly left: number;
  readonly right: number;
}

/** The space either side of the column, before any drawn margin. */
export interface ColumnSides {
  readonly left: number;
  readonly right: number;
}

/** A surface that is itself the column: margins outside it, padding inside it. */
export interface ColumnSurface {
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
}

/** How far the column stands from each edge of a window this wide, safe areas aside. */
export function columnMargin(windowWidth: number): number {
  return Math.max(0, Math.round((windowWidth - COLUMN_MAX_WIDTH) / 2));
}

/**
 * Each side keeps whichever is wider: the window's margin around the column,
 * or the safe area there. The two never add up — a status bar along one side
 * of the iPhone Duo sits inside the margin when the column is narrower than
 * the window, and only pushes the content in when the margin is too small to
 * hold it.
 */
export function columnSides(windowWidth: number, insets: SideInsets): ColumnSides {
  const margin = columnMargin(windowWidth);

  return { left: Math.max(insets.left, margin), right: Math.max(insets.right, margin) };
}

/**
 * For a sheet: its surface becomes the column, so its rounded corners sit at
 * the column's edges rather than the window's, and inside it the drawn
 * padding plus whatever safe area still reaches past the margin.
 */
export function columnSurface(windowWidth: number, insets: SideInsets, drawn: number): ColumnSurface {
  const margin = columnMargin(windowWidth);

  return {
    marginLeft: margin,
    marginRight: margin,
    paddingLeft: Math.max(0, insets.left - margin) + drawn,
    paddingRight: Math.max(0, insets.right - margin) + drawn,
  };
}
