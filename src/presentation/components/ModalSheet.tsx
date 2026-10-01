import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';

import { useDrawnSides } from '../hooks/useDrawnSides';
import { useTheme } from '../theme/ThemeProvider';
import { TapTarget } from './Button';
import { Icon, ICON_SIZE } from './Icon';

/**
 * A sheet that rises from the bottom over the whole app: the dimmed backdrop
 * that closes it and the drawing's card with 28-point corners. Through a
 * Modal, unlike `Sheet`, because it is opened from inside a scrolling screen,
 * where a view pinned to the screen's corners would scroll away with it.
 * Nothing in here takes the keyboard, so the first tap lands.
 *
 * The Modal fades rather than slides, so the backdrop darkens in place
 * instead of travelling up with the card (owner's word, 2026-10-01: these
 * sheets dim the screen more); the card rises on its own, and stands still
 * under Reduce Motion.
 */
export function ModalSheet(props: {
  readonly open: boolean;
  /** What the backdrop is, for a screen reader: the way out. */
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const sides = useDrawnSides(20);
  /* Zero is below the screen, one is in place. */
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!props.open) {
      rise.setValue(0);

      return;
    }

    if (theme.reduceMotion) {
      rise.setValue(1);

      return;
    }

    Animated.timing(rise, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [props.open, rise, theme.reduceMotion]);

  return (
    <Modal visible={props.open} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.closeLabel}
          onPress={props.onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.palette.scrim,
          }}
        />
        <Animated.View
          style={{
            backgroundColor: theme.palette.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            ...sides,
            paddingBottom: 30,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }],
          }}
        >
          {props.children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * The X a sheet closes with, top right (owner's word, 2026-10-01). Pulled out
 * by the target's own margin, so the glyph sits on the card's edge while the
 * finger still gets its 44 points.
 */
export function SheetClose(props: {
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  return (
    <View style={{ marginRight: -11, marginVertical: -10 }}>
      <TapTarget onPress={props.onPress} accessibilityLabel={props.label}>
        <Icon name="x" size={ICON_SIZE.action} color="ink" />
      </TapTarget>
    </View>
  );
}
