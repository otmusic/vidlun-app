import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/** How long "Saved" stays: a beat to be seen, not a screen to be left. */
const SHOWN_FOR_MS = 1_000;

/**
 * One word, centred, gone by itself: saving is not an event that needs a
 * button to get past. The owner asked for exactly this on the first day on
 * sale. The one exception is an entry that sounded overwhelmed — then the
 * grounding offer sits under the word with its own way in and way past, and
 * the screen waits, because an offer that vanishes in a second is not one.
 */
export function SavedScreen(props: {
  readonly t: Translate;
  /** True after an entry that sounded overwhelmed; the card below appears and the screen stays. */
  readonly offersGrounding: boolean;
  readonly onGround: () => void;
  readonly onHome: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { offersGrounding, onHome } = props;

  useEffect(() => {
    if (offersGrounding) {
      return;
    }

    const timer = setTimeout(onHome, SHOWN_FOR_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [offersGrounding, onHome]);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="display">
          {props.t('saved.title')}
        </AppText>
      </View>
      {props.offersGrounding ? (
        /*
         * Offered, never pushed: a card with a way in and a way past, worded
         * so declining costs nothing. The privacy line is on the card itself
         * because the person it is for has just said something hard out
         * loud, and "will this be kept?" is the first thing fear asks.
         */
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.palette.line,
            borderRadius: 22,
            padding: 22,
            gap: 14,
            marginBottom: 16,
          }}
        >
          <AppText variant="lede">{props.t('ground.offer')}</AppText>
          <AppText variant="secondary" color="inkFaint">
            {props.t('ground.offerFact')}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Pressable
              accessibilityRole="button"
              onPress={props.onGround}
              style={{
                borderWidth: 1,
                borderColor: theme.palette.lineStrong,
                borderRadius: 999,
                paddingVertical: 13,
                paddingHorizontal: 22,
              }}
            >
              <AppText variant="body">{props.t('ground.try')}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={props.onHome}
              hitSlop={8}
              style={{ paddingVertical: 13, paddingHorizontal: 16 }}
            >
              <AppText variant="body" color="inkFaint">
                {props.t('ground.notNow')}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
