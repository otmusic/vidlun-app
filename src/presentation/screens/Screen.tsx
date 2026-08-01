import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

/**
 * The canvas every screen sits on. Top padding clears the notch without a
 * safe-area dependency; swapping in a measured inset later is a one-file change.
 */
export function Screen(props: {
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly centered?: boolean;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.palette.canvas,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: 64,
          paddingBottom: theme.spacing.lg,
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
