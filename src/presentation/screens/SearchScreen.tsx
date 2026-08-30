import { Pressable, ScrollView, TextInput, View } from 'react-native';

import type { SearchResult } from '@/application/use-cases/SearchEntries';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Locale, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { EntryCard } from '../components/EntryCard';
import { colorForEmotion } from '../theme/emotionColor';
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
  const scheme = theme.isDark ? 'dark' : 'light';
  const { result, t } = props;

  const colourOf = (id: string): string => {
    const emotion = props.vocabulary.find(id);

    return emotion === undefined
      ? theme.palette.ink
      : colorForEmotion(props.vocabulary, emotion, scheme);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: BOTTOM_ROOM }}
      keyboardShouldPersistTaps="handled"
    >
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

      {result === null ? null : (
        <>
          <AppText variant="caption" color="inkFaint" style={{ marginBottom: 12 }}>
            {result.entries.length === 0
              ? t('search.nothing')
              : t('search.found', { n: result.entries.length })}
          </AppText>

          {result.entries.length === 0 ? (
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
          ) : (
            <View style={{ gap: 12 }}>
              {result.entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  vocabulary={props.vocabulary}
                  locale={props.locale}
                  today={props.today}
                  t={t}
                  onOpen={() => {
                    props.onOpen(entry);
                  }}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
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
