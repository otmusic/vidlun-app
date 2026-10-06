import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Pressable, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import type { Translate, TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { SheetClose } from '../components/ModalSheet';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/** Five things seen, four heard, three felt — the drawing's shortened 5-4-3. */
const STEPS: readonly {
  readonly instruction: TranslationKey;
  readonly hint: TranslationKey;
  readonly count: number;
}[] = [
  { instruction: 'ground.step1', hint: 'ground.hint1', count: 5 },
  { instruction: 'ground.step2', hint: 'ground.hint2', count: 4 },
  { instruction: 'ground.step3', hint: 'ground.hint3', count: 3 },
];

/** Filling the last segment breathes for a moment before moving on. */
const ADVANCE_AFTER_MS = 1500;

/** The ring, as drawn in the canvas variant the owner picked on 2026-10-06. */
const RING = 268;
const RADIUS = 112;
const STROKE = 16;
/** Degrees left empty between two segments, so each reads as one of several. */
const GAP_DEGREES = 10;
const INNER = 200;

/**
 * UA Mental Help, on the last page for a phone that is in Ukraine (owner's
 * word, 2026-10-06). The number is the owner's and reads the same in both
 * languages, so it lives here rather than in the copy.
 */
const UA_HELPLINE = { shown: '0 800 331 200', dial: 'tel:0800331200' } as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Arc {
  readonly d: string;
  readonly length: number;
}

/**
 * A minute of being where the body is, offered after an entry that sounded
 * overwhelmed or opened from "Me". An offer on a page of its own (owner's
 * word, 2026-10-06), three steps around a ring, and a last page — and a
 * promise the implementation keeps to the letter: **nothing here is
 * recorded**. The taps live in component state, and leaving the screen
 * leaves nothing behind. No repository, no analytics, no log.
 *
 * The drawing's prototype also listened for the words; this build counts
 * taps only, and the copy asks for taps alone.
 */
export function GroundingScreen(props: {
  readonly t: Translate;
  /** True after a hard entry: the offer comes first. Opened from "Me", the steps do. */
  readonly offered: boolean;
  /** Whether the last page names a helpline: only where it can be called for free. */
  readonly helpline: boolean;
  /** The X: back to wherever the exercise was opened from. */
  readonly onClose: () => void;
  /** The last page's button, which says home and goes there. */
  readonly onHome: () => void;
  /** One thing noticed: a tick for the hand, since the eyes are on the room. */
  readonly onNotice: () => void;
}): React.JSX.Element {
  const { t } = props;
  const [started, setStarted] = useState(!props.offered);
  const [stepIndex, setStepIndex] = useState(0);
  const [filled, setFilled] = useState(0);
  const [done, setDone] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = STEPS[stepIndex] ?? STEPS[0];

  useEffect(
    () => () => {
      if (advance.current !== null) {
        clearTimeout(advance.current);
      }
    },
    [],
  );

  const goNext = () => {
    advance.current = null;

    if (stepIndex >= STEPS.length - 1) {
      setDone(true);

      return;
    }

    setStepIndex(stepIndex + 1);
    setFilled(0);
  };

  const fillOne = () => {
    if (step === undefined || filled >= step.count) {
      return;
    }

    const now = filled + 1;

    props.onNotice();
    setFilled(now);

    if (now === step.count) {
      advance.current = setTimeout(goNext, ADVANCE_AFTER_MS);
    }
  };

  /*
   * Offered, never pushed: a way in and an X past it, worded so declining
   * costs nothing. That nothing is kept is said here, before it starts,
   * because the person it is for has just said something hard out loud, and
   * "will this be kept?" is the first thing fear asks.
   */
  if (!started) {
    return (
      <Screen>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <SheetClose label={t('common.close')} onPress={props.onClose} />
        </View>
        <View style={{ flex: 1 }} />
        <AppText variant="kicker" style={{ fontSize: 27, lineHeight: 35, marginBottom: 18 }}>
          {t('ground.offer')}
        </AppText>
        <AppText variant="secondary" color="inkSoft">
          {t('ground.offerFact')}
        </AppText>
        <View style={{ flex: 1.4 }} />
        <Button
          label={t('ground.try')}
          onPress={() => {
            setStarted(true);
          }}
        />
      </Screen>
    );
  }

  if (done || step === undefined) {
    return (
      <Screen>
        <View style={{ flex: 1 }} />
        <AppText variant="kicker" style={{ fontSize: 27, lineHeight: 35, marginBottom: 18 }}>
          {t('ground.endLine')}
        </AppText>
        <View style={{ gap: 12 }}>
          <AppText variant="secondary" color="inkSoft">
            {t('ground.endBreath')}
          </AppText>
          <AppText variant="secondary" color="inkSoft">
            {t('ground.endReturn')}
          </AppText>
        </View>
        {props.helpline ? <Helpline t={t} /> : null}
        <View style={{ flex: 1.4 }} />
        <Button label={t('ground.home')} onPress={props.onHome} />
      </Screen>
    );
  }

  /*
   * Leaving mid-exercise asks first (owner's word, 2026-10-06): an X is easy
   * to brush while turning to look around. Asked gently, with staying as the
   * way out of the question, and never in an alarm's colour.
   */
  const confirmLeave = () => {
    Alert.alert(t('ground.leaveTitle'), t('ground.leaveBody'), [
      { text: t('ground.leaveStay'), style: 'cancel' },
      { text: t('ground.leaveConfirm'), onPress: props.onClose },
    ]);
  };

  /*
   * No "next" and no "skip" (owner's word, 2026-10-06): the ring is the one
   * thing to touch. Nobody is held in a step by it, since nothing checks
   * what was noticed, and the X is always there.
   */
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* "1 of 3" in figures and as written (owner's word, 2026-10-06), not spelled out in capitals. */}
        <AppText variant="caption" color="inkFaint" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {t('ground.progress', { n: stepIndex + 1, total: STEPS.length })}
        </AppText>
        {/* An X rather than "leave" (owner's word, 2026-10-06), as on every sheet. */}
        <SheetClose label={t('common.close')} onPress={confirmLeave} />
      </View>

      <AppText variant="kicker" style={{ fontSize: 27, lineHeight: 34, marginTop: 26, marginBottom: 12 }}>
        {t(step.instruction)}
      </AppText>
      <AppText variant="secondary" color="inkSoft">
        {t(step.hint)}
      </AppText>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ring key={stepIndex} count={step.count} filled={filled} t={t} onTap={fillOne} />
      </View>
    </Screen>
  );
}

/**
 * The ring the owner picked from three on the canvas (2026-10-06): the whole
 * of it is the button, one segment per thing to notice, the count inside. It
 * breathes slowly while it waits; a tap sends a ripple out and sweeps the
 * next segment in, and a full ring fills with a tick before the next step.
 * All of it in the calm green rather than ink (owner's word, 2026-10-06).
 * Under Reduce Motion it holds still and the segments simply appear.
 */
function Ring(props: {
  readonly count: number;
  readonly filled: number;
  readonly t: Translate;
  readonly onTap: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { reduceMotion, palette } = theme;
  const arcs = useMemo(() => arcsFor(props.count), [props.count]);
  const breath = useRef(new Animated.Value(1)).current;
  /* One is at rest, where the ripple has spread out and faded. */
  const ripple = useRef(new Animated.Value(1)).current;
  const full = useRef(new Animated.Value(0)).current;
  const complete = props.filled >= props.count;

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1.03,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [breath, reduceMotion]);

  useEffect(() => {
    if (!complete) {
      return;
    }

    if (reduceMotion) {
      full.setValue(1);

      return;
    }

    Animated.timing(full, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [complete, full, reduceMotion]);

  const tap = () => {
    if (!reduceMotion) {
      ripple.setValue(0);
      Animated.timing(ripple, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }

    props.onTap();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.t('ground.ring', { n: props.filled, total: props.count })}
      accessibilityState={{ disabled: complete }}
      disabled={complete}
      onPress={tap}
      style={{ width: RING, height: RING }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: RING,
          height: RING,
          borderRadius: RING / 2,
          borderWidth: 2,
          borderColor: palette.calm,
          opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) }],
        }}
      />
      <Animated.View style={{ width: RING, height: RING, transform: [{ scale: breath }] }}>
        <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
          {arcs.map((arc, at) => (
            <Path
              key={`track-${at}`}
              d={arc.d}
              stroke={palette.line}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {arcs.slice(0, props.filled).map((arc, at) => (
            <Segment key={`fill-${at}`} arc={arc} color={palette.calm} still={reduceMotion} />
          ))}
        </Svg>
        <View
          style={{
            position: 'absolute',
            top: (RING - INNER) / 2,
            left: (RING - INNER) / 2,
            width: INNER,
            height: INNER,
            borderRadius: INNER / 2,
            backgroundColor: palette.paper,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/*
            * One line, the two halves closer in size than the drawing had
            * them (owner's word, 2026-10-06): the figure was loud and its
            * "of five" a whisper.
            */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <AppText variant="numeric" style={{ fontSize: 44, lineHeight: 52 }}>
              {String(props.filled)}
            </AppText>
            <AppText variant="numeric" color="inkSoft" style={{ fontSize: 26, lineHeight: 32 }}>
              {props.t('ground.of', { total: props.count })}
            </AppText>
          </View>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              borderRadius: INNER / 2,
              backgroundColor: palette.calm,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: full,
            }}
          >
            <Svg viewBox="0 0 24 24" width={56} height={56}>
              <Path
                d="M20 6 9 17l-5-5"
                stroke={palette.onSolid}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * One filled segment, swept in along its own length. The dash starts a
 * point past the arc's end so not even a round cap shows before it moves.
 */
function Segment(props: { readonly arc: Arc; readonly color: string; readonly still: boolean }): React.JSX.Element {
  const { arc, still } = props;
  const offset = useRef(new Animated.Value(still ? 0 : arc.length + 1)).current;

  useEffect(() => {
    if (still) {
      return;
    }

    Animated.timing(offset, {
      toValue: 0,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [offset, still]);

  return (
    <AnimatedPath
      d={arc.d}
      stroke={props.color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={[arc.length, arc.length + 2]}
      strokeDashoffset={offset}
    />
  );
}

/** The ring cut into one arc per thing to notice, clockwise from the top. */
function arcsFor(count: number): readonly Arc[] {
  const centre = RING / 2;
  const span = 360 / count;
  const point = (degrees: number): string => {
    const radians = (degrees * Math.PI) / 180;

    return `${(centre + RADIUS * Math.cos(radians)).toFixed(2)} ${(centre + RADIUS * Math.sin(radians)).toFixed(2)}`;
  };

  return Array.from({ length: count }, (_unused, at) => {
    const from = -90 + at * span + GAP_DEGREES / 2;
    const to = -90 + (at + 1) * span - GAP_DEGREES / 2;

    return {
      d: `M ${point(from)} A ${RADIUS} ${RADIUS} 0 ${to - from > 180 ? 1 : 0} 1 ${point(to)}`,
      length: (RADIUS * (to - from) * Math.PI) / 180,
    };
  });
}

/**
 * Where to turn if a minute was not enough: below the exercise rather than
 * instead of it, in the same quiet card as everything else, never in an
 * alarm's colours. The number dials on a tap, and the phone asks before it
 * calls.
 */
function Helpline(props: { readonly t: Translate }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        marginTop: 28,
        borderWidth: 1,
        borderColor: theme.palette.line,
        borderRadius: 22,
        padding: 20,
        gap: 8,
      }}
    >
      <AppText variant="secondary" color="inkSoft">
        {props.t('ground.helpLead')}
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          // A device that cannot call, like an iPad, says no; the number stays on screen.
          Linking.openURL(UA_HELPLINE.dial).catch(() => undefined);
        }}
        hitSlop={8}
      >
        <AppText variant="numeric" color="accentInk" style={{ fontSize: 20 }}>
          {UA_HELPLINE.shown}
        </AppText>
      </Pressable>
      <AppText variant="secondary" color="inkFaint">
        {props.t('ground.helpNote')}
      </AppText>
    </View>
  );
}
