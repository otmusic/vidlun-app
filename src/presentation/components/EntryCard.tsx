import { Pressable, View } from 'react-native';

import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Locale, type Translate } from '@/i18n';

import { AppText } from './AppText';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A dot in the entry's own colour, the day and time, the first emotion's own
 * name at the right in the same colour, and the sentence. The colour names
 * what the entry held; no number and no verdict appears on the card at all.
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
        borderWidth: 1,
        borderColor: theme.palette.line,
        borderRadius: 22,
        backgroundColor: theme.palette.paper,
        paddingVertical: 18,
        paddingHorizontal: 20,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: colour }} />
        <AppText variant="secondary" color="inkSoft" style={{ fontSize: 13 }}>
          {`${dayOf(props.entry.createdAt, props.locale)} · ${timeOf(props.entry.createdAt, props.locale)}`}
        </AppText>
        {first === undefined ? null : (
          <AppText
            variant="secondary"
            numberOfLines={1}
            style={{ fontSize: 13, color: colour, marginLeft: 'auto', flexShrink: 1 }}
          >
            {props.t(emotionKey(first))}
          </AppText>
        )}
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="body" style={{ fontSize: 16, lineHeight: 23 }}>
          {props.entry.cleanTranscript}
        </AppText>
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

function timeOf(date: Date, locale: Locale): string {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
