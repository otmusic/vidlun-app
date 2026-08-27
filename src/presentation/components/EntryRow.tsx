import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Translate } from '@/i18n';

import { AppText } from './AppText';
import { Icon, ICON_SIZE } from './Icon';
import { moodTone } from './emotionTone';
import { useTheme } from '../theme/ThemeProvider';

/** §7.3: a list row is never shorter than this, whatever it holds. */
const ROW_HEIGHT = 52;

type Close = () => void;

/**
 * Holds whichever row is currently swiped open, so opening another closes it.
 * Two rows showing a delete button at once reads as a list that lost track of
 * what you were doing.
 */
const OpenRow = createContext<{ current: Close | null } | null>(null);

export function SwipeGroup(props: { readonly children: ReactNode }): React.JSX.Element {
  const current = useRef<Close | null>(null);

  return <OpenRow.Provider value={current}>{props.children}</OpenRow.Provider>;
}

/**
 * One entry in a list, wherever the list is. Home and history show the same
 * thing and behave the same way: tap opens it, swipe or hold offers to delete.
 */
export function EntryRow(props: {
  readonly entry: MoodEntry;
  readonly t: Translate;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly onDelete: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const group = useContext(OpenRow);
  const swipeable = useRef<{ close: () => void } | null>(null);
  const { entry, t, onOpen, onDelete } = props;

  const confirm = (): void => {
    Alert.alert(t('delete.title'), t('delete.body'), [
      { text: t('delete.cancel'), style: 'cancel', onPress: () => swipeable.current?.close() },
      { text: t('delete.confirm'), style: 'destructive', onPress: () => onDelete(entry.id) },
    ]);
  };

  return (
    /*
     * The swipe reveals rather than deletes, and the button behind it still
     * asks. Three deliberate acts for something with no undo — a single swipe
     * that removed an entry would be the wrong gesture for a journal people
     * scroll through.
     */
    <Swipeable
      ref={(handle) => {
        swipeable.current = handle;
      }}
      friction={2}
      rightThreshold={40}
      onSwipeableWillOpen={() => {
        if (group !== null) {
          group.current?.();
          group.current = () => swipeable.current?.close();
        }
      }}
      renderRightActions={() => (
        <Pressable
          onPress={confirm}
          accessibilityLabel={t('delete.confirm')}
          style={{
            width: 76,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.palette.low,
            borderRadius: theme.radii.card,
            marginLeft: theme.spacing.sm,
          }}
        >
          <Icon name="trash-2" size={ICON_SIZE.action} color="onAccent" />
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onOpen(entry)}
        onLongPress={confirm}
        style={{
          minHeight: ROW_HEIGHT,
          backgroundColor: theme.palette.paper,
          borderWidth: 1,
          borderColor: theme.palette.line,
          borderRadius: theme.radii.card,
          paddingVertical: 18,
          paddingHorizontal: 20,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: theme.palette[moodTone(entry.mood.value)],
            }}
          />
          <AppText variant="secondary" color="inkSoft">
            {timeOf(entry.createdAt)}
          </AppText>
        </View>
        {/*
          * The sentence is the row. It is the one line a person recognises
          * their own day by, so it keeps the reading size rather than the
          * list size.
          */}
        <AppText variant="quote" numberOfLines={2}>
          {entry.cleanTranscript}
        </AppText>
      </Pressable>
    </Swipeable>
  );
}

function timeOf(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
