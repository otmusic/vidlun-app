// Imported per weight, not from the package root: the root module `require`s
// every weight the family ships, which pulled 36 font files into the bundle
// instead of the 6 this app draws with.
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { Unbounded_400Regular } from '@expo-google-fonts/unbounded/400Regular';
import { Unbounded_500Medium } from '@expo-google-fonts/unbounded/500Medium';
import { useFonts } from 'expo-font';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Image, PixelRatio, useColorScheme, View } from 'react-native';

import type { ThemeChoice } from '@/domain/ports/ISettings';

import wordmarkDark from '../../../assets/splash/wordmark-dark.png';
import wordmarkLight from '../../../assets/splash/wordmark-light.png';

import {
  createTypography,
  darkPalette,
  lightPalette,
  radii,
  spacing,
  type Palette,
  type Typography,
} from './tokens';

export interface Theme {
  readonly palette: Palette;
  readonly type: Typography;
  readonly spacing: typeof spacing;
  readonly radii: typeof radii;
  readonly isDark: boolean;
  /** True when the system asks for less movement; animations go still, layout does not. */
  readonly reduceMotion: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (theme === null) {
    throw new Error('useTheme was called outside ThemeProvider.');
  }

  return theme;
}

/**
 * `system` follows the phone and keeps following it — the journal is used in
 * the evening, and a person who never opened settings should still get the
 * dark palette then. An explicit choice outranks the phone and never yields to
 * it, because a preference that the time of day can override is not one.
 */
export function ThemeProvider(props: {
  readonly children: React.ReactNode;
  readonly choice?: ThemeChoice;
}): React.JSX.Element {
  const scheme = useColorScheme();
  const reduceMotion = useReduceMotion();
  const [fontsLoaded] = useFonts({
    Unbounded_400Regular,
    Unbounded_500Medium,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });

  const choice = props.choice ?? 'system';
  const isDark = choice === 'system' ? scheme === 'dark' : choice === 'dark';

  const theme = useMemo<Theme>(
    () => ({
      palette: isDark ? darkPalette : lightPalette,
      type: createTypography(PixelRatio.getFontScale()),
      spacing,
      radii,
      isDark,
      reduceMotion,
    }),
    [isDark, reduceMotion],
  );

  /*
   * The same wordmark pixels the native launch image shows, in the same spot,
   * so the frames between the storyboard and the splash overlay are not a
   * blink. The right margin is the dots-and-gap span of the overlay's
   * ensemble (27.5 + 9), which the launch image is offset by too.
   */
  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.palette.canvas,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={isDark ? wordmarkDark : wordmarkLight}
          style={{ width: 129, height: 47, marginRight: 36.5 }}
        />
      </View>
    );
  }

  return <ThemeContext.Provider value={theme}>{props.children}</ThemeContext.Provider>;
}

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
