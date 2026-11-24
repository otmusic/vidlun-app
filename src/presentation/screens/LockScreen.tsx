import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { LockMethod } from '@/domain/ports/IScreenLock';
import type { Translate, TranslationKey } from '@/i18n';

import wordmarkDark from '../../../assets/splash/wordmark-dark.png';
import wordmarkLight from '../../../assets/splash/wordmark-light.png';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme/ThemeProvider';

/** The splash's wordmark, at the splash's size, so the door reads as the launch. */
const WORDMARK = { width: 129, height: 47 };

/** The way in, larger than a control usually is (owner's word, 2026-11-20). */
const KEY_SIZE = 88;

const OPEN_LABELS: Readonly<Record<LockMethod, TranslationKey>> = {
  face: 'lock.openFace',
  touch: 'lock.openTouch',
  passcode: 'lock.openPasscode',
};

/**
 * The shut journal, variant B of the canvas (owner's word, 2026-11-20): the
 * name the launch shows and the app switcher shows, and a round key at the
 * bottom. It looks like the app opening rather than a door, and says nothing
 * to whoever is holding the phone. Face ID is asked for on its own; the key
 * is for a prompt that was dismissed.
 */
export function LockScreen(props: {
  readonly method: LockMethod;
  readonly t: Translate;
  readonly onUnlock: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const label = props.t(OPEN_LABELS[props.method]);

  return (
    <LockCover>
      {/* The key alone, with no caption under it (owner's word, 2026-11-24); its name is for VoiceOver. */}
      <View style={{ position: 'absolute', bottom: 56, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={props.onUnlock}
          style={({ pressed }) => ({
            width: KEY_SIZE,
            height: KEY_SIZE,
            borderRadius: KEY_SIZE / 2,
            borderWidth: 1.5,
            borderColor: theme.palette.line,
            backgroundColor: theme.palette.paper,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {props.method === 'face' ? (
            <FaceGlyph color={theme.palette.ink} />
          ) : (
            <Icon name="lock" size={34} color="ink" />
          )}
        </Pressable>
      </View>
    </LockCover>
  );
}

/**
 * The name on the canvas and nothing else: the door without its key, and
 * what the app switcher photographs while the lock is on, so nobody flipping
 * past sees the last entry that was open.
 */
export function LockCover(props: { readonly children?: ReactNode }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: theme.palette.canvas,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        accessibilityIgnoresInvertColors
        source={theme.isDark ? wordmarkDark : wordmarkLight}
        style={{ width: WORDMARK.width, height: WORDMARK.height }}
      />
      {props.children}
    </View>
  );
}

/** Face ID's own shape — four corners and a face — which Feather does not draw. */
function FaceGlyph(props: { readonly color: string }): React.JSX.Element {
  const line = {
    fill: 'none',
    stroke: props.color,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={42} height={42} viewBox="0 0 24 24">
      <Path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" {...line} />
      <Path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" {...line} />
      <Path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" {...line} />
      <Path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" {...line} />
      <Path d="M8.5 8.5v1.5" {...line} />
      <Path d="M15.5 8.5v1.5" {...line} />
      <Path d="M12 8.5v4.2h-1" {...line} />
      <Path d="M9 15.6c1.7 1.4 4.3 1.4 6 0" {...line} />
    </Svg>
  );
}
