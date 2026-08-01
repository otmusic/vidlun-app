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

  const background =
    variant === 'primary' ? theme.palette.accent : 'transparent';
  const border = variant === 'secondary' ? theme.palette.lineStrong : 'transparent';
  const color = variant === 'primary' ? 'onAccent' : 'inkSoft';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        {
          minHeight: variant === 'ghost' ? MIN_TAP_TARGET : 48,
          borderRadius: theme.radii.control,
          backgroundColor: background,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !theme.reduceMotion ? 0.98 : 1 }],
        },
        props.style,
      ]}
    >
      <AppText variant="label" color={color} align="center">
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
