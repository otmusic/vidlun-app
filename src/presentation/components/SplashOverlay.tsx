import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import wordmarkDark from '../../../assets/splash/wordmark-dark.png';
import wordmarkLight from '../../../assets/splash/wordmark-light.png';
import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeProvider';

/** The wordmark image's point size, fixed by the generator script. */
const WORDMARK = { width: 129, height: 47 };
/** Echo dots: three diminishing returns of the same voice. */
const DOTS = [7, 5, 3.5] as const;
const DOT_GAP = 6;
const ROW_GAP = 9;
/**
 * The native launch screen and the font gate show the wordmark alone, shifted
 * left by half the dots' span, so the mark does not move when this overlay
 * mounts and the ensemble takes the centre.
 */
export const DOTS_SPAN = DOTS.reduce((sum, size) => sum + size, DOT_GAP * (DOTS.length - 1));

const ENTER_EASING = Easing.out(Easing.ease);

/**
 * The splash: what the launch looks like while the journal opens.
 *
 * The wordmark never animates — it is already on screen in the native launch
 * image, and replaying an entrance over it would make one screen read as two.
 * The dots arrive one echo at a time, and the halo circles only while the
 * journal is still opening: it is the progress indicator, not a decoration.
 */
export function SplashOverlay(props: {
  readonly phase: 'loading' | 'failed' | 'leaving';
  readonly t: Translate;
  readonly onRetry: () => void;
  readonly onGone: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const quiet = theme.reduceMotion;
  const dots = useRef(DOTS.map(() => new Animated.Value(0))).current;
  const halo = useRef(new Animated.Value(0)).current;
  const screen = useRef(new Animated.Value(1)).current;
  const loading = props.phase === 'loading';

  useEffect(() => {
    if (quiet) {
      dots.forEach((dot) => {
        dot.setValue(1);
      });

      return;
    }

    const arrivals = dots.map((dot, at) =>
      Animated.timing(dot, {
        toValue: 1,
        duration: 500,
        delay: 450 + at * 170,
        easing: ENTER_EASING,
        useNativeDriver: true,
      }),
    );

    Animated.parallel(arrivals).start();
  }, [dots, quiet]);

  useEffect(() => {
    if (quiet || !loading) {
      halo.stopAnimation();
      halo.setValue(0);

      return;
    }

    const cycle = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const opening = Animated.sequence([Animated.delay(350), cycle]);

    opening.start();

    return () => {
      opening.stop();
    };
  }, [halo, loading, quiet]);

  const { onGone } = props;
  const leaving = props.phase === 'leaving';

  useEffect(() => {
    if (!leaving) {
      return;
    }

    Animated.timing(screen, {
      toValue: 0,
      duration: quiet ? 200 : 420,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onGone();
      }
    });
  }, [leaving, onGone, quiet, screen]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: theme.palette.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        opacity: screen,
      }}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {quiet ? null : (
          <Animated.View
            style={{
              position: 'absolute',
              width: 132,
              height: 132,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: theme.palette.accent,
              opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0] }),
              transform: [
                { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.65, 2.1] }) },
              ],
            }}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: ROW_GAP }}>
          <Image
            source={theme.isDark ? wordmarkDark : wordmarkLight}
            style={{ width: WORDMARK.width, height: WORDMARK.height }}
          />
          {/* Raised to the wordmark's baseline, as the drawing sets them. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: DOT_GAP,
              paddingBottom: 19,
            }}
          >
            {DOTS.map((size, at) => {
              const dot = dots[at];

              return (
                <Animated.View
                  key={size}
                  style={{
                    width: size,
                    height: size,
                    borderRadius: 999,
                    backgroundColor: theme.palette.accent,
                    opacity:
                      dot === undefined
                        ? 0.4
                        : dot.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 0.4] }),
                    transform: [
                      {
                        scale:
                          dot === undefined
                            ? 1
                            : dot.interpolate({
                                inputRange: [0, 0.45, 1],
                                outputRange: [0.35, 1, 1],
                              }),
                      },
                    ],
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>
      {props.phase === 'failed' ? (
        /* Quiet on purpose: no spinner, no alert — a sentence and a way out. */
        <View style={{ position: 'absolute', bottom: 96, alignItems: 'center', gap: 14 }}>
          <AppText variant="secondary" color="inkSoft">
            {props.t('splash.failed')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={props.onRetry}
            hitSlop={8}
            style={{
              borderWidth: 1,
              borderColor: theme.palette.lineStrong,
              borderRadius: 999,
              paddingVertical: 13,
              paddingHorizontal: 22,
            }}
          >
            <AppText variant="body">{props.t('splash.retry')}</AppText>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}
