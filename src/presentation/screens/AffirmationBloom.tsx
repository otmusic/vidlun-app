import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { SheetClose } from '../components/ModalSheet';
import { charmTint, Face, type BloomOrigin, type Charm } from '../components/AffirmationCharm';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

const BLOOM_MS = 560;
const WORDS_MS = 380;
const LEAVE_MS = 220;

export type { BloomOrigin } from '../components/AffirmationCharm';

/**
 * The affirmation on a whole screen of its colour: a circle grows out of
 * where the shape was until it covers every edge, and its face and the words
 * come up on it. Used for the pick itself and for opening the kept one again
 * from the journal, so both feel like the same thing.
 */
export function AffirmationBloom(props: {
  readonly charm: Charm;
  readonly text: string;
  readonly caption: string;
  readonly origin: BloomOrigin;
  readonly t: Translate;
  /**
   * Fades the page away before closing, for when what it covers stays on
   * screen underneath; otherwise the next screen simply takes its place.
   */
  readonly fadeOnClose?: boolean;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const window = useWindowDimensions();
  const { origin, t, onClose } = props;
  const grow = useRef(new Animated.Value(theme.reduceMotion ? 1 : 0)).current;
  const words = useRef(new Animated.Value(theme.reduceMotion ? 1 : 0)).current;
  const presence = useRef(new Animated.Value(1)).current;
  const [revealed, setRevealed] = useState(theme.reduceMotion);
  const leaving = useRef(false);
  const tint = charmTint(props.charm.tint, theme.isDark);

  useEffect(() => {
    if (theme.reduceMotion) {
      return;
    }

    Animated.timing(grow, {
      toValue: 1,
      duration: BLOOM_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setRevealed(true);
      Animated.timing(words, {
        toValue: 1,
        duration: WORDS_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [grow, theme.reduceMotion, words]);

  const leave = (): void => {
    if (leaving.current) {
      return;
    }

    leaving.current = true;

    if (props.fadeOnClose !== true || theme.reduceMotion) {
      onClose();

      return;
    }

    Animated.timing(presence, {
      toValue: 0,
      duration: LEAVE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(onClose);
  };

  /*
   * Far enough to cover the farthest corner from where the shape sat: the
   * colour has to reach every edge, the status bar's included.
   */
  const cover =
    (2 *
      Math.max(
        Math.hypot(origin.x, origin.y),
        Math.hypot(window.width - origin.x, origin.y),
        Math.hypot(origin.x, window.height - origin.y),
        Math.hypot(window.width - origin.x, window.height - origin.y),
      )) /
      origin.size +
    0.2;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: presence }]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: origin.x - origin.size / 2,
          top: origin.y - origin.size / 2,
          width: origin.size,
          height: origin.size,
          borderRadius: origin.size / 2,
          backgroundColor: tint.fill,
          transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [1, cover] }) }],
        }}
      />
      {revealed ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: words,
              transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}
        >
          <Screen style={{ backgroundColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="caption" color="inkSoft" style={{ flexShrink: 1 }}>
                {props.caption}
              </AppText>
              <SheetClose label={t('common.close')} onPress={leave} />
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ marginBottom: 18, marginLeft: -6 }}>
              <Face face={props.charm.glyph} color={tint.deep} size={72} />
            </View>
            {/* Read as a sentence, so in the reading face (§7.2), only larger (owner's word: larger still). */}
            <AppText variant="quote" style={{ fontSize: 34, lineHeight: 46 }}>
              {props.text}
            </AppText>
            {/* No "done" button (owner's word, 2026-11-16): the X at the top closes it. */}
            <View style={{ flex: 1.4 }} />
          </Screen>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
