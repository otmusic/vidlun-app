import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';

/** The bottom safe area of the phone the drawing was made on; the top lives with useDrawnTop. */
const DRAWN_BOTTOM_SAFE_AREA = 34;

/**
 * The canvas every screen sits on.
 *
 * The insets come from the design file screen by screen and are deliberately
 * off the 8-grid — 70, 74, 22, 28. The grid existed to stop arbitrary numbers
 * creeping in; now there is a drawing to measure against, and rounding to the
 * nearest 8 would be inventing numbers rather than avoiding them.
 *
 * The drawing was made on a phone with a Dynamic Island, whose safe area is
 * 59pt at the top and 34pt at the bottom. A drawn inset is that safe area
 * plus a visual margin, so here the margin is kept and the safe area is the
 * device's own: an SE, an iPad running the phone layout, a future notch all
 * get the same margin over their own bar.
 */
export function Screen(props: {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly centered?: boolean;
  readonly inset?: { readonly top?: number; readonly sides?: number; readonly bottom?: number };
}): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const top = useDrawnTop(props.inset?.top ?? 70);
  const sides = useDrawnSides(props.inset?.sides ?? 22);
  const bottom = props.inset?.bottom ?? 40;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.palette.canvas,
          ...sides,
          paddingTop: top,
          paddingBottom: Math.max(16, insets.bottom + bottom - DRAWN_BOTTOM_SAFE_AREA),
          gap: theme.spacing.sm,
        },
        props.centered === true
          ? { alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }
          : null,
        props.style,
      ]}
    >
      {props.children}
    </View>
  );
}
