import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, Easing, Pressable, View } from 'react-native';
import { Path, Rect, Svg } from 'react-native-svg';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/tokens';

const BAR_COUNT = 21;
const BAR_MIN = 0.28;
const MIDDLE = (BAR_COUNT - 1) / 2;

/** How often the screen asks whether the system has taken the microphone. */
const INTERRUPTION_CHECK_MS = 300;

/** The violet the design gives the voice, the same in both rooms. */
const BAR_VOICE = '#6E5BFF';

/**
 * The room's own colours. Since 2026-11-26 (owner's word, the design's
 * page on pausing a take, variant A) the recording screen follows the theme: a
 * light card in the light theme, the dark panel at night. Most of it comes
 * from the palette; these are the few things the palette has no word for,
 * because they appear on this screen alone. Lime on paper all but vanishes, so
 * the light room darkens the lime bars and puts the lime on an ink button
 * instead, like the record button on home.
 */
interface Room {
  readonly panel: keyof Palette;
  readonly edge: keyof Palette | null;
  readonly barLime: string;
  /** The dot by "Recording" that blinks while the take is listening. */
  readonly dot: string;
  /** The middle button: pause while recording, play while held. */
  readonly disc: keyof Palette;
  readonly discGlyph: string;
  /** The ring that leaves the middle button while it listens, and where it starts. */
  readonly halo: string;
  readonly haloFrom: number;
  readonly leave: Tint;
  readonly done: Tint;
  /** The last ten seconds of the paid five minutes. */
  readonly nearEnd: string;
}

/** A side button: a pale disc of its colour, the glyph and the caption in it. */
interface Tint {
  readonly fill: string;
  readonly glyph: string;
  readonly caption: string;
}

const LIGHT_ROOM: Room = {
  panel: 'paper',
  edge: 'line',
  barLime: '#9DC41A',
  dot: '#6F9B00',
  disc: 'record',
  discGlyph: '#D7F26B',
  halo: '#16181D',
  haloFrom: 0.3,
  leave: { fill: 'rgba(217,45,53,0.10)', glyph: '#D92D35', caption: '#C4262E' },
  done: { fill: 'rgba(31,157,85,0.12)', glyph: '#1F9D55', caption: '#1A7F45' },
  nearEnd: '#4A6800',
};

const DARK_ROOM: Room = {
  panel: 'panel',
  edge: null,
  barLime: '#D7F26B',
  dot: '#D7F26B',
  disc: 'lime',
  discGlyph: '#16181D',
  halo: '#D7F26B',
  haloFrom: 0.45,
  leave: { fill: 'rgba(255,90,80,0.16)', glyph: '#FF6B61', caption: '#FF8A80' },
  done: { fill: 'rgba(48,194,107,0.16)', glyph: '#4FD787', caption: '#4FD787' },
  nearEnd: '#D7F26B',
};

/**
 * The row is a tent: tallest in the middle, shortest at the ends, so it reads
 * as one voice rather than a bank of meters. Heights, rhythm and offset all
 * come from the design's own arithmetic — each bar runs at its own speed, and
 * bars that breathe in unison look like a loading spinner. Every third bar
 * takes the lime so the row reads as one thing rather than a stripe pattern.
 */
const BARS = Array.from({ length: BAR_COUNT }, (_unused, at) => {
  const fromMiddle = 1 - Math.abs(at - MIDDLE) / 13;

  return {
    height: Math.round(26 + fromMiddle * 96),
    lime: at % 3 === 0,
    cycleMs: (0.7 + (at % 4) * 0.18) * 1000,
    delayMs: (at % 7) * 90,
    fromMiddle: Math.abs(at - MIDDLE),
  };
});

/*
 * The motion, as the design's prototype times it (2026-11-26). The bars rise
 * from the middle out, a step apart and a touch past their height, when the
 * take starts or goes on; they sink from the ends in and lie down as a flat
 * line when it is held, and that line comes in once they are down.
 */
const RISE_MS = 420;
const RISE_STEP_MS = 22;
const SINK_MS = 300;
const SINK_STEP_MS = 14;
const LINE_IN_DELAY_MS = 260;
const LINE_MS = 200;
const LINE_OPACITY = 0.45;
const SWAP_MS = 220;
const HALO_MS = 2800;
const BLINK_MS = 700;
const BREATHE_MS = 900;
const PRESSED = 0.94;

/**
 * The one screen that is a room of its own. Recording is a place the person
 * steps into and leaves: the app goes quiet around the voice, and coming back
 * out to the journal should feel like a change of place.
 *
 * Three buttons in one row at the bottom (owner's word, 2026-11-26): leave on
 * the left, pause and go on in the middle, done on the right. The X that used
 * to sit in the corner is the left one now.
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
  /** Whether a call, Siri or an alarm has taken the microphone from the take. */
  readonly interrupted: () => boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const room = theme.isDark ? DARK_ROOM : LIGHT_ROOM;
  const top = useDrawnTop(56);
  const sides = useDrawnSides(12);
  const [paused, setPaused] = useState(false);
  const elapsed = useElapsed(!paused);
  // Read where a state update would come too late: the app's own change events.
  const held = useRef(false);
  const asking = useRef(false);
  const away = useRef(false);
  const { t, onStop, onPause, onResume, onCancel, interrupted } = props;
  const swap = useSwap(paused, theme.reduceMotion);

  const hold = useCallback(() => {
    if (held.current) {
      return;
    }

    held.current = true;
    setPaused(true);
    onPause();
  }, [onPause]);

  const goOn = useCallback(() => {
    held.current = false;
    setPaused(false);
    onResume();
  }, [onResume]);

  /*
   * Leaving is asked, never assumed (owner's word, 2026-10-30): the take is
   * held while the question is open, and staying goes on into the same
   * recording. One question at a time, so coming back to the app while the
   * leave button's question is still up does not stack a second one on it.
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
            goOn();
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
    [goOn, onCancel, t],
  );

  /*
   * Leaving the app holds the take, and the question waits for the person to
   * come back. It used to end the take outright (2026-10-29), which saved
   * whatever half a sentence had been said by then. A take the person held
   * themselves is left as it is: they come back to the same paused screen,
   * with nothing to answer.
   */
  useEffect(() => {
    const watch = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (held.current) {
          return;
        }

        away.current = true;
        hold();
      } else if (state === 'active' && away.current) {
        away.current = false;
        askToLeave('recording.pausedTitle');
      }
    });

    return () => {
      watch.remove();
    };
  }, [askToLeave, hold]);

  /*
   * A call, Siri or an alarm can take the microphone without the app leaving
   * the front, and the system does not give it back: the clock would go on
   * counting a take that hears nothing (owner's report, 2026-11-19). Held and
   * asked the same way as leaving the app, so what was said before the call
   * stays and the person decides whether to go on. Asked once back in front
   * if the call took the screen as well.
   */
  useEffect(() => {
    if (paused) {
      return undefined;
    }

    const watch = setInterval(() => {
      if (!interrupted()) {
        return;
      }

      hold();

      if (AppState.currentState === 'active') {
        askToLeave('recording.pausedTitle');
      } else {
        away.current = true;
      }
    }, INTERRUPTION_CHECK_MS);

    return () => {
      clearInterval(watch);
    };
  }, [askToLeave, interrupted, hold, paused]);

  /*
   * Stopped for them, exactly as if they had pressed done: the take is kept
   * and goes on to transcription. Cutting the recording and throwing it away
   * would punish the person for talking too long. The clock stands while the
   * take is held, so the limit counts only the time spent talking.
   */
  useEffect(() => {
    if (elapsed >= props.limitSeconds) {
      onStop();
    }
  }, [elapsed, onStop, props.limitSeconds]);

  const togglePause = useCallback(() => {
    if (held.current) {
      goOn();
    } else {
      hold();
    }
  }, [goOn, hold]);

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
          backgroundColor: theme.palette[room.panel],
          borderWidth: room.edge === null ? 0 : 1,
          borderColor: room.edge === null ? undefined : theme.palette[room.edge],
          paddingTop: 44,
          paddingHorizontal: 26,
          paddingBottom: 34,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <View>
            <LiveDot live={!paused} still={theme.reduceMotion} color={room.dot} />
            <AppText variant="caption" color={paused ? 'ink' : 'inkSoft'}>
              {t(paused ? 'recording.paused' : 'recording.listening')}
            </AppText>
          </View>
          {/*
            * The clock is the proof that the app is still there while someone
            * talks with their eyes off the screen; while the take is held it
            * breathes, because time is standing still. Tabular figures, or the
            * digits jog sideways every second.
            */}
          <Breathing held={paused} still={theme.reduceMotion}>
            <AppText variant="timer" color="ink">
              {formatElapsed(elapsed)}
            </AppText>
          </Breathing>
          {props.showsLimit ? (
            <AppText variant="caption" color="inkSoft" style={{ textTransform: 'none' }}>
              {t('record.limitFree')}
            </AppText>
          ) : null}
          {!props.showsLimit && props.limitSeconds - elapsed <= 10 ? (
            /* The paid five minutes end too, and the lime counts the last ten
               seconds down rather than stopping out of nowhere. */
            <AppText variant="caption" style={{ color: room.nearEnd, textTransform: 'none' }}>
              {t('record.nearEnd', { n: Math.max(0, props.limitSeconds - elapsed) })}
            </AppText>
          ) : null}
        </View>

        <Waveform
          still={theme.reduceMotion}
          live={!paused}
          level={props.level}
          lime={room.barLime}
        />

        <View style={{ alignItems: 'center', gap: 18, width: '100%' }}>
          <View style={{ width: '100%', maxWidth: 260 }}>
            <CrossFade swap={swap} first={t('recording.hint')} second={t('recording.resumeHint')} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%' }}>
            <SideButton
              label={t('recording.leave')}
              tint={room.leave}
              onPress={() => {
                hold();
                askToLeave('recording.leaveTitle');
              }}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6 6 18M6 6l12 12"
                  stroke={room.leave.glyph}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </SideButton>
            <PauseButton
              t={t}
              room={room}
              paused={paused}
              swap={swap}
              onPress={togglePause}
            />
            <SideButton label={t('recording.done')} tint={room.done} onPress={onStop}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke={room.done.glyph}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </SideButton>
          </View>
        </View>
      </View>
    </View>
  );
}

/** The size of the middle button; the side ones sit in a box of the same height so the row lines up. */
const DISC = 84;
const SIDE_DISC = 64;

/**
 * Leave and done: a pale disc of their own colour (owner's word, 2026-11-26:
 * done pale green like leave's pale red, not a solid one), named underneath.
 */
function SideButton(props: {
  readonly label: string;
  readonly tint: Tint;
  readonly onPress: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label}
        onPress={props.onPress}
        style={{ alignSelf: 'stretch', alignItems: 'center', gap: 8 }}
      >
        {({ pressed }) => (
          <>
            <View style={{ width: DISC, height: DISC, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: SIDE_DISC,
                  height: SIDE_DISC,
                  borderRadius: SIDE_DISC / 2,
                  backgroundColor: props.tint.fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed && !theme.reduceMotion ? PRESSED : 1 }],
                }}
              >
                {props.children}
              </View>
            </View>
            <AppText
              variant="secondary"
              numberOfLines={1}
              maxScale={1.3}
              style={{ fontSize: 13, lineHeight: 18, color: props.tint.caption }}
            >
              {props.label}
            </AppText>
          </>
        )}
      </Pressable>
    </View>
  );
}

/**
 * The record button in its other state, so it keeps the record button's lime
 * and its ring: pause while the take listens, play while it is held. The ring
 * leaves it only while listening, so a glance tells the two apart.
 */
const PauseButton = memo(function PauseButton(props: {
  readonly t: Translate;
  readonly room: Room;
  readonly paused: boolean;
  readonly swap: Animated.Value;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const still = theme.reduceMotion;
  const { swap, room } = props;
  const turn = (from: string, to: string): Animated.AnimatedInterpolation<string> =>
    swap.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const grow = (from: number, to: number): Animated.AnimatedInterpolation<number> =>
    swap.interpolate({ inputRange: [0, 1], outputRange: still ? [1, 1] : [from, to] });

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.t(props.paused ? 'recording.keep' : 'recording.pause')}
        onPress={props.onPress}
        style={{ alignSelf: 'stretch', alignItems: 'center', gap: 8 }}
      >
        {({ pressed }) => (
          <>
            <View
              style={{
                width: DISC,
                height: DISC,
                borderRadius: DISC / 2,
                backgroundColor: theme.palette[room.disc],
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#16181D',
                shadowOpacity: theme.isDark ? 0 : 0.18,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
                transform: [{ scale: pressed && !still ? PRESSED : 1 }],
              }}
            >
              <Halo live={!props.paused} still={still} color={room.halo} from={room.haloFrom} />
              <Animated.View
                style={{
                  position: 'absolute',
                  opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [{ scale: grow(1, 0.5) }, { rotate: turn('0deg', still ? '0deg' : '45deg') }],
                }}
              >
                <Svg width={28} height={28} viewBox="0 0 24 24">
                  <Rect x={6} y={4.5} width={4.2} height={15} rx={1.6} fill={room.discGlyph} />
                  <Rect x={13.8} y={4.5} width={4.2} height={15} rx={1.6} fill={room.discGlyph} />
                </Svg>
              </Animated.View>
              <Animated.View
                style={{
                  position: 'absolute',
                  opacity: swap,
                  transform: [{ scale: grow(0.5, 1) }, { rotate: turn(still ? '0deg' : '-45deg', '0deg') }],
                }}
              >
                <Svg width={30} height={30} viewBox="0 0 24 24">
                  <Path
                    d="M8.5 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7l-10.6-6.8a1 1 0 0 0-1.53.85Z"
                    fill={room.discGlyph}
                  />
                </Svg>
              </Animated.View>
            </View>
            <CrossFade
              swap={swap}
              first={props.t('recording.pause')}
              second={props.t('recording.resume')}
              colors={['inkSoft', 'ink']}
              caption
            />
          </>
        )}
      </Pressable>
    </View>
  );
});

/**
 * Two lines in one place, the second fading in as the first fades out. The
 * first stays in the layout and sizes the box; the second is laid over it,
 * across the whole box, so a longer one is still centred.
 */
const CrossFade = memo(function CrossFade(props: {
  readonly swap: Animated.Value;
  readonly first: string;
  readonly second: string;
  readonly colors?: readonly [keyof Palette, keyof Palette];
  /** A button's caption: 13/18 on one line, rather than body text. */
  readonly caption?: boolean;
}): React.JSX.Element {
  const [firstColor, secondColor] = props.colors ?? ['inkSoft', 'inkSoft'];
  const look = props.caption
    ? { variant: 'secondary' as const, lines: 1, scale: 1.3, style: { fontSize: 13, lineHeight: 18 } }
    : { variant: 'body' as const, lines: undefined, scale: undefined, style: undefined };
  const line = (text: string, color: keyof Palette): React.JSX.Element => (
    <AppText
      variant={look.variant}
      color={color}
      align="center"
      numberOfLines={look.lines}
      maxScale={look.scale}
      style={look.style}
    >
      {text}
    </AppText>
  );

  return (
    <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
      <Animated.View
        style={{ opacity: props.swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}
      >
        {line(props.first, firstColor)}
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: props.swap }}>
        {line(props.second, secondColor)}
      </Animated.View>
    </View>
  );
});

/** 0 while the take listens, 1 while it is held; everything that changes with the pause follows it. */
function useSwap(held: boolean, still: boolean): Animated.Value {
  const swap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(swap, {
      toValue: held ? 1 : 0,
      duration: still ? 150 : SWAP_MS,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [held, still, swap]);

  return swap;
}

/** The ring that leaves the middle button while the take listens: the record button's own idea, once. */
function Halo(props: {
  readonly live: boolean;
  readonly still: boolean;
  readonly color: string;
  readonly from: number;
}): React.JSX.Element | null {
  /*
   * One value runs each ring from the button outwards, 0 to 1. A loop puts
   * every value it drives back to the one it was created with before each
   * round, so the ring's own start has to be that value: driven by two (its
   * size and its fade), the fade went back to the 0 it was made with and the
   * ring never showed.
   */
  const travel = useRef(new Animated.Value(0)).current;
  const shown = useRef(new Animated.Value(0)).current;
  const opacity = useMemo(
    () =>
      Animated.multiply(shown, travel.interpolate({ inputRange: [0, 1], outputRange: [props.from, 0] })),
    [props.from, shown, travel],
  );
  const scale = useMemo(
    () => travel.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] }),
    [travel],
  );

  useEffect(() => {
    if (!props.live || props.still) {
      Animated.timing(shown, { toValue: 0, duration: 200, useNativeDriver: true }).start();

      return undefined;
    }

    travel.setValue(0);
    shown.setValue(1);

    const loop = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: HALO_MS,
        easing: Easing.bezier(0.2, 0.6, 0.3, 1),
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [props.live, props.still, shown, travel]);

  if (props.still) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: DISC / 2,
        borderWidth: 2,
        borderColor: props.color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/** The dot by "Recording", blinking slowly while the take listens and gone while it is held. */
function LiveDot(props: {
  readonly live: boolean;
  readonly still: boolean;
  readonly color: string;
}): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!props.live || props.still) {
      Animated.timing(opacity, {
        toValue: props.live ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      return undefined;
    }

    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: BLINK_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: BLINK_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      /*
       * Not put back between rounds: the round already ends where it starts,
       * and the value it would be put back to is the 0 it was created with,
       * so the dot vanished for a frame and came back every 1.4 s (owner's
       * report, 2026-11-26).
       */
      { resetBeforeIteration: false },
    );

    opacity.setValue(1);
    blink.start();

    return () => {
      blink.stop();
    };
  }, [opacity, props.live, props.still]);

  return (
    <Animated.View
      // Beside the label rather than in its row, so the label stays centred.
      style={{
        position: 'absolute',
        left: -14,
        top: 6,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: props.color,
        opacity,
      }}
    />
  );
}

/** The clock while the take is held: it fades and comes back, slowly; under Reduce Motion it only dims. */
function Breathing(props: {
  readonly held: boolean;
  readonly still: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!props.held || props.still) {
      Animated.timing(opacity, {
        toValue: props.held ? 0.5 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      return undefined;
    }

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // As the dot's: the round ends where it starts, so nothing is put back between them.
      { resetBeforeIteration: false },
    );

    breathe.start();

    return () => {
      breathe.stop();
    };
  }, [opacity, props.held, props.still]);

  return <Animated.View style={{ opacity }}>{props.children}</Animated.View>;
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
 * rhythm, and how far it reaches is how loud the voice is. In a silence the
 * row settles into a low line that still breathes, so it reads as listening
 * rather than stopped. Held, the bars lie down and a flat dotted line takes
 * their place. Under Reduce Motion the row stands still and only fades
 * between the two.
 */
const Waveform = memo(function Waveform(props: {
  readonly still: boolean;
  readonly live: boolean;
  readonly level: () => number;
  readonly lime: string;
}): React.JSX.Element {
  const voice = useVoice(props.level, props.still || !props.live);
  // How far each bar has risen: 0 lying down, 1 standing; each bar keeps its own.
  const bars = useRef(BARS.map((bar) => ({ ...bar, presence: new Animated.Value(0) }))).current;
  const line = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (props.live) {
      Animated.parallel([
        Animated.timing(line, { toValue: 0, duration: LINE_MS, useNativeDriver: true }),
        ...bars.map((bar) =>
          Animated.timing(bar.presence, {
            toValue: 1,
            duration: props.still ? 150 : RISE_MS,
            delay: props.still ? 0 : bar.fromMiddle * RISE_STEP_MS,
            easing: Easing.bezier(0.2, 0.9, 0.3, 1.15),
            useNativeDriver: true,
          }),
        ),
      ]).start();

      return;
    }

    Animated.parallel([
      ...bars.map((bar) =>
        Animated.timing(bar.presence, {
          toValue: 0,
          duration: props.still ? 150 : SINK_MS,
          delay: props.still ? 0 : (MIDDLE - bar.fromMiddle) * SINK_STEP_MS,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ),
      Animated.timing(line, {
        toValue: LINE_OPACITY,
        duration: LINE_MS,
        delay: props.still ? 0 : LINE_IN_DELAY_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [bars, line, props.live, props.still]);

  return (
    <View style={{ height: 108, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 108 }}>
        {bars.map((bar, at) => (
          <Animated.View
            key={at}
            style={{
              opacity: bar.presence.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0, 1, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scaleY: props.still
                    ? 1
                    : bar.presence.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }),
                },
              ],
            }}
          >
            <Bar
              height={bar.height}
              color={bar.lime ? props.lime : BAR_VOICE}
              cycleMs={bar.cycleMs}
              delay={bar.delayMs}
              still={props.still || !props.live}
              voice={props.still ? null : voice}
            />
          </Animated.View>
        ))}
      </View>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          opacity: line,
        }}
      >
        {BARS.map((bar, at) => (
          <View
            key={at}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: bar.lime ? props.lime : BAR_VOICE,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
});

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
