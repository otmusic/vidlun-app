import { Pressable, View } from 'react-native';

import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Locale, type Translate, type TranslationKey } from '@/i18n';

import { AppText } from './AppText';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

const MOOD_LABELS: readonly TranslationKey[] = ['mood.1', 'mood.2', 'mood.3', 'mood.4', 'mood.5'];

/**
 * A rail in the entry's own colour, the day and the mood, the sentence, and
 * the words underneath. The rail is the only colour on the card: it says at a
 * glance what kind of day this was without putting a verdict in words.
 */
export function EntryCard(props: {
  readonly entry: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpen: () => void;
  /** The words underneath, which the search results do without. */
  readonly showEmotions?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const scheme = theme.isDark ? 'dark' : 'light';
  const first = props.entry.emotionIds[0];
  const emotion = first === undefined ? undefined : props.vocabulary.find(first);
  const colour =
    emotion === undefined
      ? theme.palette.line
      : colorForEmotion(props.vocabulary, emotion, scheme);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onOpen}
      style={{
        flexDirection: 'row',
        gap: 15,
        borderWidth: 1,
        borderColor: theme.palette.line,
        borderRadius: 22,
        backgroundColor: theme.palette.paper,
        paddingVertical: 18,
        paddingHorizontal: 20,
      }}
    >
      <View style={{ width: 4, borderRadius: 4, backgroundColor: colour }} />
      <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppText variant="secondary" color="inkSoft">
            {dayOf(props.entry.createdAt, props.locale)}
          </AppText>
          <AppText variant="secondary" color="inkFaint">
            ·
          </AppText>
          {props.entry.mood === null ? null : (
            <AppText variant="secondary" style={{ color: colour }}>
              {props.t(MOOD_LABELS[props.entry.mood.value - 1] ?? 'mood.3')}
            </AppText>
          )}
        </View>
        <AppText variant="body">{props.entry.cleanTranscript}</AppText>
        {props.showEmotions !== true || props.entry.emotionIds.length === 0 ? null : (
          <AppText variant="secondary" color="inkFaint">
            {props.entry.emotionIds.map((id) => props.t(emotionKey(id))).join(' · ')}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

function dayOf(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}
