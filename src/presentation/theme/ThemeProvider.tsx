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
import { AccessibilityInfo, PixelRatio, useColorScheme, View } from 'react-native';

import type { ThemeChoice } from '@/domain/ports/ISettings';

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

  // Showing the canvas rather than nothing keeps the launch from flashing white
  // on a dark phone, which is the whole point of a separate dark palette.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.palette.canvas }} />;
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
