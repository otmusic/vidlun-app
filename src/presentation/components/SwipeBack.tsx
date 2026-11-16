import { useMemo, useRef, type ReactNode } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../theme/ThemeProvider';

/** How far in from the left edge a swipe has to start, as the system's own does. */
const EDGE = 28;
/** Past a third of the screen, or flung, the swipe goes back. */
const FAR_ENOUGH = 1 / 3;
const FAST_ENOUGH = 600;

/**
 * Back with a swipe from the left edge (owner's word, 2026-11-16), on every
 * screen that has a back button, doing what that button does. The screen
 * follows the finger and leaves to the right; let go short of a third and it
 * settles back. Under Reduce Motion it does not move, it only goes back.
 *
 * §7.5 says nothing slides sideways. That is about transitions the app plays
 * by itself; this one is the person's finger, moving what they touch.
 */
export function SwipeBack(props: {
  /** What the screen's back button does; null where there is no way back. */
  readonly onBack: (() => void) | null;
  readonly children: ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const shift = useRef(new Animated.Value(0)).current;
  const { onBack } = props;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(onBack !== null)
        .hitSlop({ left: 0, width: EDGE })
        .activeOffsetX(12)
        .failOffsetY([-18, 18])
        .onUpdate((event) => {
          if (!theme.reduceMotion) {
            shift.setValue(Math.max(0, event.translationX));
          }
        })
        .onEnd((event) => {
          const goes = event.translationX > width * FAR_ENOUGH || event.velocityX > FAST_ENOUGH;

          if (!goes) {
            Animated.spring(shift, { toValue: 0, bounciness: 0, useNativeDriver: true }).start();

            return;
          }

          if (theme.reduceMotion) {
            onBack?.();

            return;
          }

          Animated.timing(shift, { toValue: width, duration: 160, useNativeDriver: true }).start(() => {
            onBack?.();
            shift.setValue(0);
          });
        }),
    [onBack, shift, theme.reduceMotion, width],
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: shift }] }}>{props.children}</Animated.View>
    </GestureDetector>
  );
}
