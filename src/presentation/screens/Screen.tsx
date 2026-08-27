import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

/**
 * The canvas every screen sits on. Top padding clears the notch without a
 * safe-area dependency; swapping in a measured inset later is a one-file change.
 *
 * The insets come from the design file screen by screen and are deliberately
 * off the 8-grid — 70, 74, 22, 28. The grid existed to stop arbitrary numbers
 * creeping in; now there is a drawing to measure against, and rounding to the
 * nearest 8 would be inventing numbers rather than avoiding them.
 */
export function Screen(props: {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly centered?: boolean;
  readonly inset?: { readonly top?: number; readonly sides?: number; readonly bottom?: number };
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.palette.canvas,
          paddingHorizontal: props.inset?.sides ?? 22,
          paddingTop: props.inset?.top ?? 70,
          paddingBottom: props.inset?.bottom ?? 40,
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
