import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import type { Translate } from '@/i18n';

import { useDrawnSides } from '../hooks/useDrawnSides';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

/** How long a deletion can be taken back: the toast's own five seconds. */
export const UNDO_FOR_S = 5;

const RING = 30;
const STROKE = 2.5;
const RADIUS = (RING - STROKE) / 2 - 0.25;
const AROUND = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * "Entry deleted", with the way back (owner's word, 2026-11-19, the canvas's
 * undo page): the same panel as the app's other notices, a ring that thins as
 * the seconds go and counts them down in its middle, and "Undo". Five seconds,
 * a tap on the line, or another deletion make it final.
 *
 * Under Reduce Motion the ring steps once a second instead of draining.
 */
export function UndoToast(props: {
  /** Distinct per deletion, null when there is nothing to undo. */
  readonly showing: number | null;
  readonly t: Translate;
  readonly onUndo: () => void;
  readonly onSettle: () => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sides = useDrawnSides();
  const rise = useRef(new Animated.Value(0)).current;
  /* One is the whole ring, zero none of it. */
  const left = useRef(new Animated.Value(1)).current;
  const [seconds, setSeconds] = useState(UNDO_FOR_S);
  const { showing, onSettle } = props;

  useEffect(() => {
    if (showing === null) {
      return undefined;
    }

    setSeconds(UNDO_FOR_S);
    left.setValue(1);

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
      Animated.timing(left, {
        toValue: 0,
        duration: UNDO_FOR_S * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    }

    let remaining = UNDO_FOR_S;
    const tick = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        clearInterval(tick);
        onSettle();

        return;
      }

      setSeconds(remaining);

      if (theme.reduceMotion) {
        left.setValue(remaining / UNDO_FOR_S);
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      left.stopAnimation();
    };
  }, [showing, onSettle, left, rise, theme.reduceMotion]);

  if (showing === null) {
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
          accessibilityLabel={props.t('undo.deleted')}
          onPress={onSettle}
          style={{
            backgroundColor: theme.palette.panel,
            borderRadius: theme.radii.tile,
            paddingVertical: 10,
            paddingLeft: 18,
            paddingRight: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
            <View
              accessible
              accessibilityRole="timer"
              accessibilityLabel={props.t('undo.left', { n: seconds })}
              style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}
            >
              <Svg
                width={RING}
                height={RING}
                style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
              >
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={theme.palette.onPanel}
                  strokeOpacity={0.22}
                  strokeWidth={STROKE}
                />
                <AnimatedCircle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={theme.palette.onPanel}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${String(AROUND)} ${String(AROUND)}`}
                  strokeDashoffset={left.interpolate({ inputRange: [0, 1], outputRange: [AROUND, 0] })}
                />
              </Svg>
              <AppText
                variant="numeric"
                color="onPanel"
                maxScale={1}
                style={{ fontSize: 12, lineHeight: 14 }}
              >
                {String(seconds)}
              </AppText>
            </View>
            <AppText color="onPanel" style={{ flexShrink: 1 }}>
              {props.t('undo.deleted')}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={props.onUndo}
            hitSlop={4}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: 'rgba(251,247,240,0.55)',
              borderRadius: theme.radii.pill,
              paddingHorizontal: 18,
            }}
          >
            <AppText variant="secondary" color="onPanel">
              {props.t('undo.action')}
            </AppText>
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}
