import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

/**
 * A sheet that rises from the bottom over whatever is on screen: a dimmed
 * backdrop that closes it, a card with the drawing's 28-point corners, and a
 * keyboard it rises with.
 *
 * Drawn into the screen rather than through a Modal, and that is not a
 * style choice: inside a Modal on iOS 26 the first touch anywhere outside a
 * focused field went to putting the keyboard away, the sheet dropped under
 * the finger, and the button needed a second tap. In the tree, the first
 * tap lands. The slide a Modal would have given is kept, and stands still
 * under Reduce Motion.
 */
export function Sheet(props: {
  readonly open: boolean;
  /** What the backdrop is, for a screen reader: the way out. */
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element | null {
  const theme = useTheme();
  /* Zero is below the screen, one is in place. */
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!props.open) {
      rise.setValue(0);

      return;
    }

    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) {
        return;
      }

      if (reduced) {
        rise.setValue(1);

        return;
      }

      Animated.timing(rise, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      cancelled = true;
    };
  }, [props.open, rise]);

  if (!props.open) {
    return null;
  }

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.closeLabel}
        onPress={props.onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,12,16,0.42)' }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' }}
      >
        <Animated.View
          style={{
            backgroundColor: theme.palette.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }],
          }}
        >
          <View style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 30, gap: 12 }}>
            {props.children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
