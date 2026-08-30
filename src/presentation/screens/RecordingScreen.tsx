import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';

const BAR_COUNT = 21;
const BAR_MIN = 0.28;

/**
 * Two colours, and they are constants rather than tokens: this panel is dark
 * in both themes, so there is no light variant of them to hold. Lime is the
 * product's own; the violet is what the design gives the voice, and every
 * third bar takes the lime so the row reads as one thing rather than a stripe
 * pattern.
 */
const BAR_LIME = '#D7F26B';
const BAR_VOICE = '#6E5BFF';

/**
 * The row is a tent: tallest in the middle, shortest at the ends, so it reads
 * as one voice rather than a bank of meters. Heights, rhythm and offset all
 * come from the design's own arithmetic — each bar runs at its own speed, and
 * bars that breathe in unison look like a loading spinner.
 */
const BARS = Array.from({ length: BAR_COUNT }, (_unused, at) => {
  const fromMiddle = 1 - Math.abs(at - 10) / 13;

  return {
    height: Math.round(26 + fromMiddle * 96),
    color: at % 3 === 0 ? BAR_LIME : BAR_VOICE,
    cycleMs: (0.7 + (at % 4) * 0.18) * 1000,
    delayMs: (at % 7) * 90,
  };
});

/**
 * The one screen that is a dark panel in both themes. Recording is a room the
 * person steps into and leaves: the app goes quiet around the voice, and
 * coming back out to the journal should feel like a change of place.
 */
export function RecordingScreen(props: {
  readonly t: Translate;
  /** Seconds, after which the take stops itself. The paid minute count is longer. */
  readonly limitSeconds: number;
  /** True when the shorter limit applies and is worth saying out loud. */
  readonly showsLimit: boolean;
  readonly onStop: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const elapsed = useElapsed();
  const { onStop } = props;

  /*
   * Stopped for them, exactly as if they had pressed stop: the take is kept
   * and goes on to transcription. Cutting the recording and throwing it away
   * would punish the person for talking too long.
   */
  useEffect(() => {
    if (elapsed >= props.limitSeconds) {
      onStop();
    }
  }, [elapsed, onStop, props.limitSeconds]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.palette.canvas,
        paddingTop: 56,
        paddingHorizontal: 12,
        paddingBottom: 34,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 34,
          backgroundColor: theme.palette.panel,
          paddingTop: 44,
          paddingHorizontal: 26,
          paddingBottom: 34,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText variant="caption" color="tileInk">
            {props.t('recording.listening')}
          </AppText>
          {/*
            * The clock is the proof that the app is still there while someone
            * talks with their eyes off the screen. Tabular figures, or the
            * digits jog sideways every second.
            */}
          <AppText variant="timer" color="onPanel">
            {formatElapsed(elapsed)}
          </AppText>
          {props.showsLimit ? (
            <AppText variant="caption" color="tileInk">
              {props.t('record.limitFree')}
            </AppText>
          ) : null}
        </View>

        <Waveform still={theme.reduceMotion} />

        <View style={{ alignItems: 'center', gap: 18, width: '100%' }}>
          <AppText variant="body" color="tileInk" align="center" style={{ maxWidth: 260 }}>
            {props.t('recording.hint')}
          </AppText>
          <StopButton label={props.t('recording.stop')} onPress={props.onStop} />
          <Button label={props.t('common.cancel')} variant="ghost" onPress={props.onCancel} />
        </View>
      </View>
    </View>
  );
}

/**
 * Lime, and the only other place it appears: this is the record button in its
 * other state, not a second use of the colour.
 */
function StopButton(props: {
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: theme.palette.lime,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed && !theme.reduceMotion ? 0.96 : 1 }],
      })}
    >
      <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: '#16181D' }} />
    </Pressable>
  );
}

function Waveform(props: { readonly still: boolean }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 108 }}>
      {BARS.map((bar, at) => (
        <Bar
          key={at}
          height={bar.height}
          color={bar.color}
          cycleMs={bar.cycleMs}
          delay={bar.delayMs}
          still={props.still}
        />
      ))}
    </View>
  );
}

function Bar(props: {
  readonly height: number;
  readonly delay: number;
  readonly cycleMs: number;
  readonly still: boolean;
  readonly color: string;
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(BAR_MIN)).current;

  useEffect(() => {
    if (props.still) {
      scale.setValue(1);

      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(props.delay),
        Animated.timing(scale, {
          toValue: 1,
          duration: props.cycleMs / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: BAR_MIN,
          duration: props.cycleMs / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [props.cycleMs, props.delay, props.still, scale]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: props.height,
        borderRadius: 4,
        backgroundColor: props.color,
        transform: [{ scaleY: scale }],
      }}
    />
  );
}

function useElapsed(): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => {
      clearInterval(tick);
    };
  }, []);

  return seconds;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
