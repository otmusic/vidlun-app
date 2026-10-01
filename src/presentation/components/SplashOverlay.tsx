import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import wordmarkDark from '../../../assets/splash/wordmark-dark.png';
import wordmarkLight from '../../../assets/splash/wordmark-light.png';
import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeProvider';

/** The wordmark image's point size, fixed by the generator script. */
const WORDMARK = { width: 129, height: 47 };

/**
 * The splash: what the launch looks like while the journal opens — the name
 * and nothing else (owner's word, 2026-10-01). The echo dots that arrived one
 * by one and the halo that circled while the journal opened are gone.
 *
 * The word holds still: it is the same pixels in the same place as the
 * phone's own launch image, centred in both, so the launch reads as one
 * screen. Leaving is still a crossfade into the screen underneath — that is
 * the screen changing, not the splash moving.
 */
export function SplashOverlay(props: {
  readonly phase: 'loading' | 'failed' | 'leaving';
  readonly t: Translate;
  readonly onRetry: () => void;
  readonly onGone: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const quiet = theme.reduceMotion;
  const screen = useRef(new Animated.Value(1)).current;

  const leaving = props.phase === 'leaving';
  /*
   * Read through a ref so the fade below depends on nothing the parent
   * re-renders. It used to depend on the callback itself, which the parent
   * recreated every render — and the download's progress re-renders it
   * several times a second, so the fade restarted each time, never reported
   * itself finished, and the overlay stayed mounted, transparent, on top of
   * the very button it had already revealed.
   */
  const onGone = useRef(props.onGone);
  onGone.current = props.onGone;

  useEffect(() => {
    if (!leaving) {
      return;
    }

    const duration = quiet ? 200 : 420;
    let gone = false;
    const leave = (): void => {
      if (!gone) {
        gone = true;
        onGone.current();
      }
    };

    Animated.timing(screen, {
      toValue: 0,
      duration,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start(leave);
    // Whatever the animation reports, the overlay is gone when its time is.
    const deadline = setTimeout(leave, duration + 60);

    return () => {
      clearTimeout(deadline);
    };
  }, [leaving, quiet, screen]);

  return (
    <Animated.View
      // Touches fall through the moment the fade starts: the screen beneath
      // is already the one the person is looking at.
      pointerEvents={leaving ? 'none' : 'auto'}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: theme.palette.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: screen,
      }}
    >
      <Image
        source={theme.isDark ? wordmarkDark : wordmarkLight}
        style={{ width: WORDMARK.width, height: WORDMARK.height }}
      />
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
