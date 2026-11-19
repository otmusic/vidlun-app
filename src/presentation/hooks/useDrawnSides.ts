import { useColumnSides } from './useColumn';

/**
 * A screen's side margins as drawn, moved to this device's own side safe areas.
 *
 * The drawing keeps 22pt from either edge on a phone whose status bar sits on
 * top, so its sides carry no safe area at all. iPhone Duo puts the status bar,
 * the Dynamic Island and the system bars along one side instead, and two apps
 * in Split View each get one such side — so the margin is kept and each side
 * adds whatever the device reserves there, independently of the other.
 *
 * On a window wider than the column (the open iPhone Duo), each side also
 * holds the space around the column, so the content stands in the middle
 * (owner's word, 2026-11-18; see `COLUMN_MAX_WIDTH`).
 */
export function useDrawnSides(drawn = 22): { readonly paddingLeft: number; readonly paddingRight: number } {
  const column = useColumnSides();

  return { paddingLeft: column.left + drawn, paddingRight: column.right + drawn };
}
