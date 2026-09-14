import { Modal, Pressable, View } from 'react-native';

import { useDrawnSides } from '../hooks/useDrawnSides';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A sheet that rises from the bottom over the whole app: the dimmed backdrop
 * that closes it and the drawing's card with 28-point corners. Through a
 * Modal, unlike `Sheet`, because it is opened from inside a scrolling screen,
 * where a view pinned to the screen's corners would scroll away with it.
 * Nothing in here takes the keyboard, so the first tap lands.
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

  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.closeLabel}
          onPress={props.onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,12,16,0.42)' }}
        />
        <View
          style={{
            backgroundColor: theme.palette.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            ...sides,
            paddingBottom: 30,
          }}
        >
          {props.children}
        </View>
      </View>
    </Modal>
  );
}
