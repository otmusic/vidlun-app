import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

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

  const choice = props.choice ?? 'system';
  const isDark = choice === 'system' ? scheme === 'dark' : choice === 'dark';

  const theme = useMemo<Theme>(
    () => ({
      palette: isDark ? darkPalette : lightPalette,
      type: createTypography(),
      spacing,
      radii,
      isDark,
      reduceMotion,
    }),
    [isDark, reduceMotion],
  );

  /*
   * No font gate any more: the five faces are built into the binary (see
   * app.json) and are there from the first frame, so the launch image hands
   * straight to the app. The wordmark placeholder that used to bridge the
   * wait went with it.
   */
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
