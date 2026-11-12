import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, Easing, Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { TapTarget } from '../components/Button';
import { Icon, ICON_SIZE } from '../components/Icon';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
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
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onCancel: () => void;
  /** How loud the voice is right now, 0 to 1; read many times a second. */
  readonly level: () => number;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(56);
  const sides = useDrawnSides(12);
  const [paused, setPaused] = useState(false);
  const elapsed = useElapsed(!paused);
  const asking = useRef(false);
  const away = useRef(false);
  const { t, onStop, onPause, onResume, onCancel } = props;

  /*
   * Leaving is asked, never assumed (owner's word, 2026-10-30): the take is
   * held while the question is open, and staying goes on into the same
   * recording. One question at a time, so coming back to the app while the
   * X's question is still up does not stack a second one on it.
   */
  const askToLeave = useCallback(
    (titleKey: 'recording.leaveTitle' | 'recording.pausedTitle') => {
      if (asking.current) {
        return;
      }

      asking.current = true;
      Alert.alert(t(titleKey), t('recording.leaveBody'), [
        {
          text: t('recording.keep'),
          style: 'cancel',
          onPress: () => {
            asking.current = false;
            setPaused(false);
            onResume();
          },
        },
        {
          text: t('recording.leave'),
          style: 'destructive',
          onPress: () => {
            asking.current = false;
            onCancel();
          },
        },
      ]);
    },
    [onCancel, onResume, t],
  );

  const pause = useCallback(() => {
    setPaused(true);
    onPause();
  }, [onPause]);

  /*
   * Leaving the app holds the take, and the question waits for the person to
   * come back. It used to end the take outright (2026-10-29), which saved
   * whatever half a sentence had been said by then.
   */
  useEffect(() => {
    const watch = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        away.current = true;
        pause();
      } else if (state === 'active' && away.current) {
        away.current = false;
        askToLeave('recording.pausedTitle');
      }
    });

    return () => {
      watch.remove();
    };
  }, [askToLeave, pause]);

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
        paddingTop: top,
        ...sides,
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
        {/*
          * The way out is an X in the corner (owner's word, 2026-10-30), level
          * with the label, so the bottom of the panel holds only the stop.
          */}
        <View style={{ position: 'absolute', top: 30, right: 14, opacity: 0.7, zIndex: 1 }}>
          <TapTarget
            accessibilityLabel={t('common.close')}
            onPress={() => {
              pause();
              askToLeave('recording.leaveTitle');
            }}
          >
            <Icon name="x" size={ICON_SIZE.action} color="onPanel" />
          </TapTarget>
        </View>
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
            <AppText variant="caption" color="tileInk" style={{ textTransform: 'none' }}>
              {props.t('record.limitFree')}
            </AppText>
          ) : null}
          {!props.showsLimit && props.limitSeconds - elapsed <= 10 ? (
            /* The paid five minutes end too, and lime counts the last ten
               seconds down rather than stopping out of nowhere. */
            <AppText variant="caption" style={{ color: '#D7F26B', textTransform: 'none' }}>
              {props.t('record.nearEnd', { n: Math.max(0, props.limitSeconds - elapsed) })}
            </AppText>
          ) : null}
        </View>

        <Waveform still={theme.reduceMotion} paused={paused} level={props.level} />

        <View style={{ alignItems: 'center', gap: 18, width: '100%' }}>
          <AppText variant="body" color="tileInk" align="center" style={{ maxWidth: 260 }}>
            {props.t('recording.hint')}
          </AppText>
          <StopButton label={props.t('recording.stop')} onPress={props.onStop} />
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

/**
 * How often the voice is read, and how quickly the bars follow it: up at once
 * when a word starts, down more slowly when it ends, so the row moves like a
 * voice rather than flickering like a meter.
 */
const LISTEN_MS = 70;
const RISE = 0.7;
const FALL = 0.22;

/*
 * The bars move with the voice (owner's word, 2026-11-12): each keeps its own
 * rhythm, and how far it reaches is how loud the voice is. In a pause the row
 * settles into a low line that still breathes, so it reads as listening
 * rather than stopped. Under Reduce Motion the row stands still, as before.
 */
function Waveform(props: {
  readonly still: boolean;
  readonly paused: boolean;
  readonly level: () => number;
}): React.JSX.Element {
  const voice = useVoice(props.level, props.still || props.paused);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 108 }}>
      {BARS.map((bar, at) => (
        <Bar
          key={at}
          height={bar.height}
          color={bar.color}
          cycleMs={bar.cycleMs}
          delay={bar.delayMs}
          still={props.still || props.paused}
          voice={props.still ? null : voice}
        />
      ))}
    </View>
  );
}

/** The voice's loudness as an animated value, eased the way the bars should follow it. */
function useVoice(level: () => number, deaf: boolean): Animated.Value {
  const voice = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (deaf) {
      Animated.timing(voice, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      return undefined;
    }

    let heard = 0;
    const listen = setInterval(() => {
      const now = level();

      heard += (now - heard) * (now > heard ? RISE : FALL);
      Animated.timing(voice, {
        toValue: heard,
        duration: LISTEN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }, LISTEN_MS);

    return () => {
      clearInterval(listen);
    };
  }, [deaf, level, voice]);

  return voice;
}

function Bar(props: {
  readonly height: number;
  readonly delay: number;
  readonly cycleMs: number;
  readonly still: boolean;
  readonly color: string;
  /** The voice's loudness; null draws the bar at its own height, unmoved by it. */
  readonly voice: Animated.Value | null;
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(BAR_MIN)).current;
  /*
   * The bar's own rhythm times how loud the voice is: silent, a low breathing
   * line; loud, the whole tent.
   */
  const reach = useMemo(
    () =>
      props.voice === null
        ? scale
        : Animated.multiply(
            props.voice.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.88] }),
            scale,
          ).interpolate({ inputRange: [0, 1], outputRange: [0.12, 1.12] }),
    [props.voice, scale],
  );

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
        transform: [{ scaleY: reach }],
      }}
    />
  );
}

/** Counts only while `running`, so a held take keeps the time it had. */
function useElapsed(running: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const tick = setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => {
      clearInterval(tick);
    };
  }, [running]);

  return seconds;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
