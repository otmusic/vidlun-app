import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import type { AffirmationChoice, KeptAffirmation } from '@/domain/entities/KeptAffirmation';
import type { AffirmationFrequency } from '@/domain/ports/IAffirmationReminders';
import { affirmationsFor, type Locale, type Translate, type TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import {
  CHARM_FACES,
  CHARM_SHAPES,
  CHARM_TINT_COUNT,
  CharmMark,
  charmOf,
  charmTint,
  type Charm,
} from '../components/AffirmationCharm';
import { SheetClose } from '../components/ModalSheet';
import { useTheme } from '../theme/ThemeProvider';
import { AffirmationBloom, type BloomOrigin } from './AffirmationBloom';
import { drawCards } from './affirmationDraw';
import { scatter, type Spot } from './affirmationScatter';
import { Screen } from './Screen';

const CHOICES = 5;
/** Room between the hint and the first shape, so none crowds the words. */
const ROOM_TOP = 18;
const POP_MS = 420;
const POP_STAGGER_MS = 80;
/** The colour starts inside the shape rather than at its edge, so it grows out of it. */
const BLOOM_START = 0.55;
/** The kept one has no shape on screen to grow out of, so it grows from the middle. */
const KEPT_BLOOM_SIZE = 120;


const CAPTIONS: Readonly<Record<AffirmationFrequency, TranslationKey>> = {
  daily: 'affirmation.yoursDaily',
  weekly: 'affirmation.yoursWeekly',
  monthly: 'affirmation.yoursMonthly',
};

export function affirmationCaption(frequency: AffirmationFrequency, t: Translate): string {
  return t(CAPTIONS[frequency]);
}

interface Dealt extends Charm {
  /** Where it sits in its language's list, as "uk.3"; kept with the pick, never shown. */
  readonly key: string;
  readonly words: string;
}

/** Five shapes, colours, faces and affirmations, all drawn at random. */
function deal(locale: Locale, random: () => number): readonly Dealt[] {
  const listed = affirmationsFor(locale).map((words, at) => ({ key: `${locale}.${at + 1}`, words }));
  const words = drawCards(listed, CHOICES, random);
  // One of each kind, in a new order every time: no set holds two of one shape.
  const shapes = drawCards(CHARM_SHAPES, CHOICES, random);
  const tints = drawCards(
    Array.from({ length: CHARM_TINT_COUNT }, (_none, at) => at),
    CHOICES,
    random,
  );
  const faces = drawCards(CHARM_FACES, CHOICES, random);

  return words.map((affirmation, at) => ({
    key: affirmation.key,
    words: affirmation.words,
    shape: shapes[at] ?? 'circle',
    tint: tints[at] ?? at,
    glyph: faces[at] ?? 'smile',
  }));
}

interface Picked {
  readonly at: number;
  readonly origin: BloomOrigin;
}

/**
 * Five small things to pick from — a circle, a cloud, a flower, a heart and a star, each its own
 * soft colour with a happy face — and the one picked grows until its
 * colour is the whole screen, the affirmation coming up on it (owner's word,
 * 2026-11-06: the cards were too plain, and a small card turning before the
 * words was a step too many). Opened from the morning notification.
 *
 * The pick is kept for the day, week or month it was made in, and while it
 * is, the notification opens it again instead of five new ones.
 *
 * Not in the design file: drawn here in the app's own type, with colours of
 * the page's own.
 */
export function AffirmationScreen(props: {
  readonly t: Translate;
  /** The app's language, which picks the list the five are dealt from. */
  readonly locale: Locale;
  /** How often they come, which names the period on the picked one. */
  readonly frequency: AffirmationFrequency;
  /** The one already picked for this period, shown instead of the five. */
  readonly kept: KeptAffirmation | null;
  readonly onKeep: (choice: AffirmationChoice) => void;
  /** A tick under the finger as the choice is made. */
  readonly onFlip: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const { t, kept } = props;
  const window = useWindowDimensions();

  if (kept !== null) {
    return (
      <View style={{ flex: 1 }}>
        <AffirmationBloom
          charm={charmOf(kept.look)}
          text={kept.text}
          caption={affirmationCaption(kept.frequency, t)}
          origin={{ x: window.width / 2, y: window.height / 2, size: KEPT_BLOOM_SIZE }}
          t={t}
          onClose={props.onClose}
        />
      </View>
    );
  }

  return <FivePicks {...props} />;
}

function FivePicks(props: {
  readonly t: Translate;
  readonly locale: Locale;
  readonly frequency: AffirmationFrequency;
  readonly onKeep: (choice: AffirmationChoice) => void;
  readonly onFlip: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  // Dealt once per visit; coming back deals again.
  const [charms] = useState(() => deal(props.locale, Math.random));
  const [picked, setPicked] = useState<Picked | null>(null);
  // Thrown once the room is known, and kept: a relayout must not reshuffle them.
  const [spots, setSpots] = useState<readonly Spot[] | null>(null);
  const page = useRef<View>(null);

  const pick = (at: number, target: View | null): void => {
    const charm = charms[at];

    if (picked !== null || charm === undefined || target === null || page.current === null) {
      return;
    }

    props.onFlip();
    props.onKeep({
      key: charm.key,
      text: charm.words,
      look: { shape: charm.shape, tint: charm.tint, glyph: charm.glyph },
    });

    const from = page.current;

    from.measureInWindow((pageX, pageY) => {
      target.measureInWindow((x, y, width, height) => {
        setPicked({
          at,
          origin: {
            x: x - pageX + width / 2,
            y: y - pageY + height / 2,
            size: Math.min(width, height) * BLOOM_START,
          },
        });
      });
    });
  };

  const chosen = picked === null ? undefined : charms[picked.at];

  return (
    <View ref={page} style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="caption" color="inkFaint">
            {t('affirmation.kicker')}
          </AppText>
          <SheetClose label={t('common.close')} onPress={props.onClose} />
        </View>

        <AppText variant="kicker" style={{ fontSize: 27, lineHeight: 34, marginTop: 26, marginBottom: 6 }}>
          {t('affirmation.title')}
        </AppText>
        <AppText variant="secondary" color="inkSoft">
          {t('affirmation.hint')}
        </AppText>

        {/*
          * The rest of the page is theirs to be thrown across (owner's word,
          * 2026-11-10: scattered more freely, bigger, faces in place of icons).
          */}
        <View
          style={{ flex: 1, marginTop: ROOM_TOP }}
          onLayout={(event: LayoutChangeEvent) => {
            const { width, height } = event.nativeEvent.layout;

            setSpots((thrown) => thrown ?? scatter(CHOICES, width, height, Math.random));
          }}
        >
          {spots === null
            ? null
            : charms.map((charm, at) => {
                const spot = spots[at];

                return spot === undefined ? null : (
                  <Choice
                    key={charm.key}
                    index={at}
                    charm={charm}
                    spot={spot}
                    label={t('affirmation.card', { n: at + 1 })}
                    hidden={picked !== null}
                    isDark={theme.isDark}
                    onPick={(target) => {
                      pick(at, target);
                    }}
                  />
                );
              })}
        </View>
      </Screen>

      {picked === null || chosen === undefined ? null : (
        <AffirmationBloom
          charm={chosen}
          text={chosen.words}
          caption={affirmationCaption(props.frequency, t)}
          origin={picked.origin}
          t={t}
          onClose={props.onClose}
        />
      )}
    </View>
  );
}

/**
 * One of the five: its shape in its colour with a happy face on it, where it
 * was thrown and leaning a little, popping in a little after the one before.
 * Picked or not, all five fade once a choice is made, and the colour that
 * grows takes over from there.
 */
function Choice(props: {
  readonly index: number;
  readonly charm: Charm;
  readonly spot: Spot;
  readonly label: string;
  readonly hidden: boolean;
  readonly isDark: boolean;
  readonly onPick: (target: View | null) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const target = useRef<View>(null);
  const pop = useRef(new Animated.Value(theme.reduceMotion ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const { index, hidden } = props;

  useEffect(() => {
    if (theme.reduceMotion) {
      return;
    }

    Animated.timing(pop, {
      toValue: 1,
      duration: POP_MS,
      delay: index * POP_STAGGER_MS,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1.2),
      useNativeDriver: true,
    }).start();
  }, [index, pop, theme.reduceMotion]);

  useEffect(() => {
    if (!hidden) {
      return;
    }

    Animated.timing(fade, {
      toValue: 0,
      duration: theme.reduceMotion ? 0 : 220,
      useNativeDriver: true,
    }).start();
  }, [fade, hidden, theme.reduceMotion]);

  return (
    <Pressable
      ref={target}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={hidden}
      onPress={() => {
        props.onPick(target.current);
      }}
      style={{
        position: 'absolute',
        left: props.spot.x,
        top: props.spot.y,
        width: props.spot.size,
        height: props.spot.size,
      }}
    >
      <Animated.View
        style={{
          opacity: Animated.multiply(pop, fade),
          transform: [
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            { rotate: `${props.spot.turn}deg` },
          ],
        }}
      >
        <CharmMark charm={props.charm} tint={charmTint(props.charm.tint, props.isDark)} size={props.spot.size} />
      </Animated.View>
    </Pressable>
  );
}
