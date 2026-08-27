import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TAP_TARGET } from '../theme/tokens';
import { AppText } from './AppText';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

/** One primary button per screen; everything else is secondary or text. */
export function Button(props: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const variant = props.variant ?? 'primary';
  const disabled = props.disabled ?? false;

  /*
   * The primary button carries contrast rather than colour: ink on light,
   * paper on dark. It is the loudest thing on a screen without spending the
   * accent, which now means one thing and only one.
   */
  const background =
    variant === 'primary'
      ? theme.palette.solid
      : variant === 'secondary'
        ? theme.palette.paper
        : 'transparent';
  const border = variant === 'secondary' ? theme.palette.line : 'transparent';
  const color =
    variant === 'primary' ? 'onSolid' : variant === 'secondary' ? 'ink' : 'inkFaint';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        {
          minHeight: MIN_TAP_TARGET,
          borderRadius: theme.radii.pill,
          backgroundColor: background,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          // Straight from the design rather than rounded to the 8-grid: these
          // are the numbers the buttons were drawn with, and a filled pill
          // reads as underweight a few points short of them.
          paddingHorizontal: 20,
          paddingVertical: variant === 'ghost' ? 14 : 18,
          opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !theme.reduceMotion ? 0.98 : 1 }],
        },
        props.style,
      ]}
    >
      <AppText
        variant="label"
        color={color}
        align="center"
        style={variant === 'ghost' ? undefined : { fontSize: 16 }}
      >
        {props.label}
      </AppText>
    </Pressable>
  );
}

/** Wraps a small visual in a target a finger can actually land on. */
export function TapTarget(props: {
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={{
        minWidth: MIN_TAP_TARGET,
        minHeight: MIN_TAP_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View pointerEvents="none">{props.children}</View>
    </Pressable>
  );
}
