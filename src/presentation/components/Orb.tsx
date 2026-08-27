import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MicShape, StopShape } from './Shapes';

export type OrbMode = 'idle' | 'recording' | 'thinking';

export interface OrbProps {
  readonly mode: OrbMode;
  readonly accessibilityLabel: string;
  readonly onPress?: () => void;
  readonly size?: number;
}

const BREATHE_MS = 3600;
const PULSE_MS = 1500;

/**
 * The only element allowed continuous motion: it breathes while idle and
 * pulses while recording, so a person who is talking and not looking at the
 * screen can still see the app is listening. Under Reduce Motion the ring
 * simply stops; nothing about the layout changes.
 */
export function Orb(props: OrbProps): React.JSX.Element {
  const theme = useTheme();
  const size = props.size ?? 128;
  const ring = useRef(new Animated.Value(0)).current;
  const isRecording = props.mode === 'recording';

  useEffect(() => {
    if (theme.reduceMotion) {
      ring.setValue(0);

      return;
    }

    const loop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: isRecording ? PULSE_MS : BREATHE_MS,
        easing: isRecording ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );

    ring.setValue(0);
    loop.start();

    return () => {
      loop.stop();
    };
  }, [isRecording, ring, theme.reduceMotion]);

  /*
   * The button is ink, not accent, and the accent lives in the rings leaving
   * it. That is the mark's own idea: the sound goes out and fades, so the only
   * coloured thing on the screen is the part that is departing.
   */
  const background = isRecording ? theme.palette.lowSoft : theme.palette.solid;
  const glyph = isRecording ? theme.palette.low : theme.palette.onSolid;

  const body = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: isRecording ? theme.palette.low : theme.palette.accent,
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [
            { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, isRecording ? 1.35 : 1.29] }) },
          ],
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {props.mode === 'thinking' ? (
          <Waveform color={theme.palette.accent} still={theme.reduceMotion} />
        ) : isRecording ? (
          <StopShape color={glyph} size={size * 0.36} />
        ) : (
          <MicShape color={glyph} size={size * 0.27} />
        )}
      </View>
    </View>
  );

  if (props.onPress === undefined) {
    return body;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={({ pressed }) => ({
        transform: [{ scale: pressed && !theme.reduceMotion ? 0.96 : 1 }],
      })}
    >
      {body}
    </Pressable>
  );
}

const BAR_DELAYS = [0, 150, 300, 100, 250];

export function Waveform(props: {
  readonly color: string;
  readonly still: boolean;
}): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36 }}>
      {BAR_DELAYS.map((delay) => (
        <WaveBar key={delay} color={props.color} delay={delay} still={props.still} />
      ))}
    </View>
  );
}

function WaveBar(props: {
  readonly color: string;
  readonly delay: number;
  readonly still: boolean;
}): React.JSX.Element {
  const height = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (props.still) {
      height.setValue(0.5);

      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(props.delay),
        Animated.timing(height, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(height, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [height, props.delay, props.still]);

  return (
    <Animated.View
      style={{
        width: 4,
        borderRadius: 2,
        backgroundColor: props.color,
        height: height.interpolate({ inputRange: [0, 1], outputRange: [8, 30] }),
      }}
    />
  );
}
