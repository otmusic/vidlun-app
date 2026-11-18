import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Icon, ICON_SIZE } from './Icon';
import { useTheme } from '../theme/ThemeProvider';

/**
 * What stands over a paid part of the app for someone without a
 * subscription (owner's word, 2026-10-23): frosted glass over the shape of
 * the thing, a veil of the card's own paper so the words read against
 * something quiet, and a lock with the way in. The parent clips it and
 * takes the tap.
 */
export function LockOverlay(props: { readonly label: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <>
      <BlurView
        intensity={theme.isDark ? 34 : 30}
        tint={theme.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.palette.paper, opacity: 0.3 }]}
      />
      <View
        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 44,
            backgroundColor: theme.palette.solid,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={ICON_SIZE.inline} color="onSolid" />
        </View>
        <AppText variant="body" color="accentInk">
          {props.label} ›
        </AppText>
      </View>
    </>
  );
}

/** How long the line stands, picked by the entry's id so the cards do not all look alike. */
const LINE_WIDTHS = ['82%', '64%', '74%', '58%', '70%'] as const;

/**
 * Where a locked entry's sentence would be (owner's word, 2026-11-17): one
 * faint line, and nothing of the words. The card around it keeps its day, its
 * time and its mood's colour, with a small lock where the emotion was.
 */
export function LockedLine(props: {
  readonly entryId: string;
  /** On the accent's soft tint (the month-ago card), where the hairline beige reads as a stain. */
  readonly onAccent?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  let sum = 0;

  for (const char of props.entryId) {
    sum += char.charCodeAt(0);
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: 10,
        width: LINE_WIDTHS[sum % LINE_WIDTHS.length],
        borderRadius: 5,
        // The card's own hairline colour: there, and quieter than any word.
        backgroundColor: props.onAccent === true ? theme.palette.accentInk : theme.palette.line,
        opacity: props.onAccent === true ? 0.14 : 1,
        marginVertical: 6,
      }}
    />
  );
}
