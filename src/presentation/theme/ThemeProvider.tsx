// Imported per weight, not from the package root: the root module `require`s
// every weight the family ships, which pulled 36 font files into the bundle
// instead of the 6 this app draws with.
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { useFonts } from 'expo-font';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, PixelRatio, useColorScheme, View } from 'react-native';

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

export function ThemeProvider(props: { readonly children: React.ReactNode }): React.JSX.Element {
  const scheme = useColorScheme();
  const reduceMotion = useReduceMotion();
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const isDark = scheme === 'dark';

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
