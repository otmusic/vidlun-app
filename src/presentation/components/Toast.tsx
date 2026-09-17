import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrawnSides } from '../hooks/useDrawnSides';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

/** How long a line stays before leaving on its own: long enough to read twice. */
const SHOWN_FOR_MS = 5_000;

export interface ToastLine {
  /** Distinct per showing, so the same words twice still come in twice. */
  readonly id: number;
  readonly title: string;
  /** The second line, or null when the title says it all. */
  readonly detail: string | null;
}

/**
 * One line laid over the top of whatever is on screen, and gone on its own.
 *
 * Not in the drawing, which has no failure state at all: the owner asked for
 * a toast in place of the failure screen (2026-09-17), because the screen
 * took the card with it. It is set on the language's loudest surface, the
 * panel, so it reads over paper and canvas alike, and it takes no tap to
 * leave — one leaves it sooner.
 */
export function Toast(props: {
  readonly line: ToastLine | null;
  /** What tapping the line does, for a screen reader. */
  readonly dismissHint: string;
  readonly onDismiss: () => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sides = useDrawnSides();
  /* Zero is above the screen and clear, one is in place. */
  const rise = useRef(new Animated.Value(0)).current;
  const { line, onDismiss } = props;
  /*
   * The showing, not the line: the screen builds a fresh line object on
   * every render, and an effect keyed on it would restart the rise and the
   * clock each time anything else on the screen moved.
   */
  const showing = line?.id ?? null;

  useEffect(() => {
    if (showing === null) {
      return undefined;
    }

    if (theme.reduceMotion) {
      rise.setValue(1);
    } else {
      rise.setValue(0);
      Animated.timing(rise, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }

    const leave = setTimeout(onDismiss, SHOWN_FOR_MS);

    return () => {
      clearTimeout(leave);
    };
  }, [showing, onDismiss, rise, theme.reduceMotion]);

  if (line === null) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, ...sides }}
    >
      <Animated.View
        style={{
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        }}
      >
        <Pressable
          accessibilityRole="alert"
          accessibilityHint={props.dismissHint}
          onPress={onDismiss}
          style={{
            backgroundColor: theme.palette.panel,
            borderRadius: theme.radii.tile,
            paddingVertical: 14,
            paddingHorizontal: 18,
            gap: 2,
          }}
        >
          <AppText color="onPanel">{line.title}</AppText>
          {line.detail === null ? null : (
            <AppText variant="secondary" color="onPanel" style={{ opacity: 0.72 }}>
              {line.detail}
            </AppText>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
