import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * A screen's side margins as drawn, moved to this device's own side safe areas.
 *
 * The drawing keeps 22pt from either edge on a phone whose status bar sits on
 * top, so its sides carry no safe area at all. iPhone Duo puts the status bar,
 * the Dynamic Island and the system bars along one side instead, and two apps
 * in Split View each get one such side — so the margin is kept and each side
 * adds whatever the device reserves there, independently of the other.
 */
export function useDrawnSides(drawn = 22): { readonly paddingLeft: number; readonly paddingRight: number } {
  const insets = useSafeAreaInsets();

  return { paddingLeft: insets.left + drawn, paddingRight: insets.right + drawn };
}
