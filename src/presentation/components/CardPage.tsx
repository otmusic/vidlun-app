import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';

/**
 * One step of the card: what it asks scrolls, and its buttons stay at the
 * foot of the screen, under the thumb, however long the entry is (owner's
 * word, 2026-11-23). A long transcript scrolls under them; a short one never
 * makes the person look for the way on.
 */
export function CardPage(props: {
  readonly children: React.ReactNode;
  /** The step's buttons, one under the other. */
  readonly footer: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(58);
  const sides = useDrawnSides();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.canvas }}>
      <ScrollView
        style={{ flex: 1 }}
        // A word or a topic is typed in place: the keyboard must not cover it, nor eat the tap on its tick.
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: 24, gap: 14 }}
      >
        {props.children}
      </ScrollView>
      <View style={{ ...sides, paddingTop: 10, paddingBottom: insets.bottom + 12, gap: theme.spacing.xs }}>
        {props.footer}
      </View>
    </View>
  );
}
