import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../theme/ThemeProvider';

/** How far in from the left edge a swipe has to start, as the system's own does. */
const EDGE = 28;
/** Past a third of the screen, or flung, the swipe goes back. */
const FAR_ENOUGH = 1 / 3;
const FAST_ENOUGH = 600;
/** How long the screen takes to leave once let go past the line. */
const LEAVE_MS = 200;
/**
 * The screen that left is normally gone by now; if it is still here, going
 * back did not change the screen, and it comes back into place.
 */
const STILL_HERE_MS = 400;

/**
 * Back with a swipe from the left edge (owner's word, 2026-11-16), on every
 * screen that has a back button, doing what that button does. The screen
 * follows the finger and leaves to the right; let go short of a third and it
 * settles back. Under Reduce Motion it does not move, it only goes back.
 *
 * The screen it goes back to is drawn underneath where it is kept (owner's
 * word, 2026-11-24), moved by the same `shift`, so the swipe shows where it
 * goes and lands there as it was. The screen leaving is not put back in
 * place when it is let go: it is about to be gone, and putting it back
 * first showed it again for a frame.
 *
 * §7.5 says nothing slides sideways. That is about transitions the app plays
 * by itself; this one is the person's finger, moving what they touch.
 */
export function SwipeBack(props: {
  /** What the screen's back button does; null where there is no way back. */
  readonly onBack: (() => void) | null;
  /** How far the screen has moved, shared with the screen drawn under it. */
  readonly shift: Animated.Value;
  readonly children: ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { onBack, shift } = props;
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

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

          Animated.timing(shift, { toValue: width, duration: LEAVE_MS, useNativeDriver: true }).start(() => {
            onBack?.();
            setTimeout(() => {
              if (mounted.current) {
                shift.setValue(0);
              }
            }, STILL_HERE_MS);
          });
        }),
    [onBack, shift, theme.reduceMotion, width],
  );

  return (
    <GestureDetector gesture={pan}>
      {/*
        * The screen's own ground moves with it, so whatever is kept under it
        * shows as it goes; a soft shadow on its left edge, off screen at rest,
        * sets it above that.
        */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: theme.palette.canvas,
          shadowColor: '#000000',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: -4, height: 0 },
          transform: [{ translateX: shift }],
        }}
      >
        {props.children}
      </Animated.View>
    </GestureDetector>
  );
}
