import { useCallback } from 'react';
import { FlatList, Pressable, TextInput, View, type ListRenderItem } from 'react-native';

import type { SearchResult } from '@/application/use-cases/SearchEntries';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Locale, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { EntryCard } from '../components/EntryCard';
import { colorForEmotion } from '../theme/emotionColor';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';

/** The bar floats over this screen, so the last card needs room under it. */
const BOTTOM_ROOM = 118;

/**
 * Finding one entry again out of a year of them.
 *
 * Two ways in, because people remember an entry either way: a word they said,
 * or the feeling it carried. The filters are the person's own most-used words
 * rather than a fixed set — offering "gratitude" to someone who has never
 * named it is offering an empty room.
 */
export function SearchScreen(props: {
  readonly result: SearchResult | null;
  readonly query: string;
  readonly emotionId: string | null;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly today: Date;
  readonly t: Translate;
  readonly onQuery: (query: string) => void;
  readonly onFilter: (emotionId: string | null) => void;
  readonly onReset: () => void;
  readonly onOpen: (entry: MoodEntry) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const scheme = theme.isDark ? 'dark' : 'light';
  const { result, t, onOpen } = props;

  const colourOf = (id: string): string => {
    const emotion = props.vocabulary.find(id);

    return emotion === undefined
      ? theme.palette.ink
      : colorForEmotion(props.vocabulary, emotion, scheme);
  };

  const renderEntry = useCallback<ListRenderItem<MoodEntry>>(
    ({ item: entry }) => (
      <EntryCard
        entry={entry}
        vocabulary={props.vocabulary}
        locale={props.locale}
        today={props.today}
        t={t}
        onOpen={() => {
          onOpen(entry);
        }}
      />
    ),
    [onOpen, props.locale, props.today, props.vocabulary, t],
  );

  return (
    /*
     * The field and the filters stay put and only the results scroll: a
     * search box that scrolls away is one to scroll back to before every
     * second try, and a list that owns the keyboard's field re-mounts it.
     */
    <View style={{ flex: 1, backgroundColor: theme.palette.canvas, paddingTop: top, ...sides }}>
      <AppText variant="display" style={{ marginBottom: 18 }}>
        {t('search.title')}
      </AppText>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: theme.palette.line,
          borderRadius: 999,
          backgroundColor: theme.palette.paper,
          paddingVertical: 13,
          paddingHorizontal: 18,
          marginBottom: 14,
        }}
      >
        <TextInput
          value={props.query}
          onChangeText={props.onQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={theme.palette.inkFaint}
          accessibilityLabel={t('search.title')}
          returnKeyType="search"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 16,
            color: theme.palette.ink,
            fontFamily: theme.type.body.fontFamily,
            padding: 0,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        <Filter
          label={t('search.filterAll')}
          colour={theme.palette.ink}
          selected={props.emotionId === null}
          onPress={() => {
            props.onFilter(null);
          }}
        />
        {(result?.filterIds ?? []).map((id) => (
          <Filter
            key={id}
            label={t(emotionKey(id))}
            colour={colourOf(id)}
            selected={props.emotionId === id}
            onPress={() => {
              props.onFilter(id);
            }}
          />
        ))}
      </View>

      <FlatList
        data={result?.entries ?? []}
        keyExtractor={keyOf}
        renderItem={renderEntry}
        ItemSeparatorComponent={Gap}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: BOTTOM_ROOM }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={
          result === null ? null : (
            <AppText variant="caption" color="inkFaint" style={{ marginBottom: 12 }}>
              {result.entries.length === 0
                ? t('search.nothing')
                : t('search.found', { n: result.entries.length })}
            </AppText>
          )
        }
        ListEmptyComponent={
          result === null ? null : (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 52, paddingHorizontal: 12 }}>
              <AppText variant="kicker">{t('search.nothingTitle')}</AppText>
              <AppText variant="body" color="inkSoft" align="center" style={{ maxWidth: 240 }}>
                {t('search.nothingBody')}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={props.onReset}
                style={{
                  borderWidth: 1,
                  borderColor: theme.palette.line,
                  backgroundColor: theme.palette.paper,
                  borderRadius: 999,
                  paddingVertical: 13,
                  paddingHorizontal: 22,
                }}
              >
                <AppText variant="body">{t('search.reset')}</AppText>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
}

function keyOf(entry: MoodEntry): string {
  return entry.id;
}

/** The drawing's 12pt between cards. */
function Gap(): React.JSX.Element {
  return <View style={{ height: 12 }} />;
}

/**
 * Outlined in the word's own colour, filled with it when it is the one in
 * force. The colour is the word, so a chosen filter is that word turned solid
 * rather than a tick beside it.
 */
function Filter(props: {
  readonly label: string;
  readonly colour: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={{
        borderWidth: 1.5,
        borderColor: props.colour,
        backgroundColor: props.selected ? props.colour : 'transparent',
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 15,
      }}
    >
      <AppText
        variant="secondary"
        style={{ color: props.selected ? theme.palette.onSolid : props.colour }}
      >
        {props.label}
      </AppText>
    </Pressable>
  );
}
