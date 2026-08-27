import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/**
 * The wait, shaped like what is coming. A spinner says only that something is
 * happening; an outline of the card says what it will be, which is why the
 * same three or four seconds read as shorter here.
 */
export function ProcessingScreen(props: { readonly t: Translate }): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen inset={{ top: 82, sides: 24, bottom: 40 }} style={{ gap: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <AppText variant="display" style={{ fontSize: 22, letterSpacing: -0.44 }}>
          {props.t('processing.thinking')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 4, paddingBottom: 4 }}>
          {[0, 200, 400].map((delay) => (
            <Dot key={delay} delay={delay} still={theme.reduceMotion} />
          ))}
        </View>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: theme.palette.line,
          borderRadius: 26,
          backgroundColor: theme.palette.paper,
          padding: 24,
          gap: 18,
        }}
      >
        <Placeholder height={13} width="44%" radius={7} still={theme.reduceMotion} />
        <View style={{ gap: 10 }}>
          <Placeholder height={19} width="100%" radius={8} still={theme.reduceMotion} />
          <Placeholder height={19} width="82%" radius={8} still={theme.reduceMotion} delay={100} />
          <Placeholder height={19} width="58%" radius={8} still={theme.reduceMotion} delay={200} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 4 }}>
          {[92, 78, 104].map((width) => (
            <View
              key={width}
              style={{
                height: 33,
                width,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.palette.skeleton,
              }}
            />
          ))}
        </View>
      </View>

      <AppText variant="secondary" color="inkFaint">
        {props.t('processing.hint')}
      </AppText>
    </Screen>
  );
}

/**
 * The design sweeps a gradient across each placeholder. React Native has no
 * gradient without another dependency, so these breathe between the two
 * skeleton tones instead — the same signal that the wait is alive, drawn with
 * what is already here.
 */
function Placeholder(props: {
  readonly height: number;
  readonly width: number | `${number}%`;
  readonly radius: number;
  readonly still: boolean;
  readonly delay?: number;
}): React.JSX.Element {
  const theme = useTheme();
  const lift = usePulse(props.still, props.delay ?? 0);

  return (
    <Animated.View
      style={{
        height: props.height,
        width: props.width,
        borderRadius: props.radius,
        backgroundColor: theme.palette.skeleton,
        opacity: lift,
      }}
    />
  );
}

function Dot(props: { readonly delay: number; readonly still: boolean }): React.JSX.Element {
  const theme = useTheme();
  const lift = usePulse(props.still, props.delay);

  return (
    <Animated.View
      style={{
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: theme.palette.accent,
        opacity: lift,
      }}
    />
  );
}

function usePulse(still: boolean, delay: number): Animated.Value {
  const value = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (still) {
      value.setValue(1);

      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.45,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [delay, still, value]);

  return value;
}
