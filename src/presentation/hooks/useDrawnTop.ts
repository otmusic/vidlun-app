import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The top safe area of the phone the drawing was made on: a Dynamic Island iPhone. */
export const DRAWN_TOP_SAFE_AREA = 59;

/**
 * A screen's top padding as drawn, moved to this device's own safe area.
 *
 * The drawing gives each screen a number — 70, 74, 82 — measured on a phone
 * whose status bar takes 59pt. What the number really says is "this much
 * margin under the bar", so the margin is kept and the bar is whatever this
 * device has: 20pt on an SE, 24pt on an iPad running the phone layout.
 */
export function useDrawnTop(drawn = 70): number {
  const insets = useSafeAreaInsets();

  return insets.top + Math.max(0, drawn - DRAWN_TOP_SAFE_AREA);
}
