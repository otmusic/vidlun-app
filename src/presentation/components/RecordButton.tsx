import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Path, Rect, Svg } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { WaveMark } from './WaveMark';

const BUTTON = 152;
const FIELD = 196;
const RING_MS = 3400;
const RING_SCALE = 1.16;
const RING_OPACITY = 0.34;

/**
 * The one continuously moving thing in the product. Two rings leave the button
 * and fade — the mark's own idea, that sound goes out and stops being there —
 * so the only coloured motion on the screen is the part that is departing.
 *
 * Under Reduce Motion the rings simply stop. Nothing about the layout changes,
 * and the button is no less obviously a button.
 */
export function RecordButton(props: {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ width: FIELD, height: FIELD, alignItems: 'center', justifyContent: 'center' }}>
      <Ring delay={0} still={theme.reduceMotion} />
      <Ring delay={RING_MS / 2} still={theme.reduceMotion} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        onPress={props.onPress}
        style={({ pressed }) => ({
          width: BUTTON,
          height: BUTTON,
          borderRadius: BUTTON / 2,
          backgroundColor: theme.palette.record,
          borderWidth: 1,
          borderColor: theme.palette.recordEdge,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          shadowColor: '#16181D',
          shadowOpacity: 0.22,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 14 },
          transform: [{ scale: pressed && !theme.reduceMotion ? 0.97 : 1 }],
        })}
      >
        <MicGlyph color={theme.palette.onRecord} />
        {/*
          * The mark sits under the microphone rather than beside it: the glyph
          * says what the button does, the wave says whose button it is.
          */}
        <WaveMark width={52} color={theme.palette.lime} />
      </Pressable>
    </View>
  );
}

function Ring(props: { readonly delay: number; readonly still: boolean }): React.JSX.Element {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (props.still) {
      progress.setValue(0);

      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(props.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: RING_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    progress.setValue(0);
    loop.start();

    return () => {
      loop.stop();
    };
  }, [progress, props.delay, props.still]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: BUTTON,
        height: BUTTON,
        borderRadius: BUTTON / 2,
        borderWidth: 1.5,
        borderColor: theme.palette.accent,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [RING_OPACITY, 0] }),
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, RING_SCALE] }) },
        ],
      }}
    />
  );
}

function MicGlyph(props: { readonly color: string }): React.JSX.Element {
  return (
    <Svg width={34} height={41} viewBox="0 0 28 34">
      <Rect x={9} y={2} width={10} height={15} rx={5} fill="none" stroke={props.color} strokeWidth={2.6} />
      <Path
        d="M4.5 15.5a9.5 9.5 0 0 0 19 0"
        fill="none"
        stroke={props.color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path d="M14 25.5v5.5" stroke={props.color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}
