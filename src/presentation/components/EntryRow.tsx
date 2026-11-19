import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { type Locale, type Translate } from '@/i18n';

import { AppText } from './AppText';
import { TapTarget } from './Button';
import { dayWordOf } from './dayWord';
import { Icon, ICON_SIZE } from './Icon';
import { LockedLine } from './LockGlass';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, emotionWordsIn, moodTint } from './emotionDisplay';

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
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  /** What day it is, so the header can say "today" of today. */
  readonly today: Date;
  readonly t: Translate;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly onDelete: (id: string) => void;
  /**
   * Set when the entry is under the subscription's lock (owner's word,
   * 2026-11-17): the way in, read aloud. The row keeps its day, time and
   * mood colour, a small lock stands where the emotion was, one faint line
   * where the words were, and the tap goes wherever `onOpen` says. Deleting
   * still works — the entry is the person's own, read here or not.
   */
  readonly lockedHint?: string;
}): React.JSX.Element {
  const theme = useTheme();
  const group = useContext(OpenRow);
  const swipeable = useRef<{ close: () => void; openRight: () => void } | null>(null);
  const { entry, t, onOpen, onDelete } = props;
  const marker = moodTint(entry.mood?.value ?? null, theme);
  const words = emotionWordsIn(entry.cleanTranscript, t);

  return (
    /*
     * The swipe reveals rather than deletes: a single swipe that removed an
     * entry would be the wrong gesture for a journal people scroll through.
     * The button behind it deletes at once (owner's word, 2026-11-19), and
     * the undo line offers the entry back for five seconds; holding the row
     * only opens it to the button, so a long press can never delete alone.
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
        /*
         * The entry page's own bin (owner's word, 2026-11-19): the red glyph
         * alone on the canvas, no longer a red block the height of the row.
         */
        <View style={{ width: 56, alignItems: 'flex-end', justifyContent: 'center' }}>
          <TapTarget
            accessibilityLabel={t('delete.confirm')}
            onPress={() => {
              swipeable.current?.close();
              onDelete(entry.id);
            }}
          >
            <Icon name="trash-2" size={ICON_SIZE.action} color="danger" />
          </TapTarget>
        </View>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          props.lockedHint === undefined
            ? undefined
            : `${dayWordOf(entry.createdAt, props.today, props.locale, t)} · ${timeOf(entry.createdAt, props.locale)}. ${props.lockedHint}`
        }
        onPress={() => onOpen(entry)}
        onLongPress={() => swipeable.current?.openRight()}
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
          {/* The entry's mood colour (owner's word, 2026-10-01) — the line where it has none. */}
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: marker }} />
          <AppText variant="secondary" color="inkSoft" style={{ fontSize: 13 }}>
            {`${dayWordOf(entry.createdAt, props.today, props.locale, t)} · ${timeOf(entry.createdAt, props.locale)}`}
          </AppText>
          {props.lockedHint === undefined ? null : (
            <View style={{ marginLeft: 'auto' }}>
              <Icon name="lock" size={14} color="inkFaint" />
            </View>
          )}
        </View>
        {/*
          * The sentence is the row. It is the one line a person recognises
          * their own day by, so it keeps the reading size rather than the
          * list size.
          */}
        {props.lockedHint === undefined ? (
          <View style={{ gap: 8 }}>
            <AppText variant="quote" numberOfLines={2} style={{ fontSize: 16, lineHeight: 23 }}>
              {entry.cleanTranscript}
            </AppText>
            {/*
              * Every emotion under the sentence in the one blue, as the
              * journal's card has it (owner's word, 2026-11-19), in place of
              * the first one alone at the top right.
              */}
            {entry.emotionIds.length === 0 ? null : (
              <AppText variant="secondary" style={{ color: theme.palette.tag }}>
                {entry.emotionIds.map((id) => emotionLabel(id, words)).join(' · ')}
              </AppText>
            )}
          </View>
        ) : (
          <LockedLine entryId={entry.id} />
        )}
      </Pressable>
    </Swipeable>
  );
}

function timeOf(date: Date, locale: Locale): string {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
