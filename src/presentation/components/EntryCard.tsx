import { Pressable, View } from 'react-native';

import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { type Locale, type Translate } from '@/i18n';

import { AppText } from './AppText';
import { dayWordOf } from './dayWord';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, emotionWordsIn, moodTint } from './emotionDisplay';

/**
 * A dot in the entry's own colour, the day and time, the sentence, and the
 * emotions under it in the one blue (owner's word, 2026-11-16: the first
 * emotion at the top right went, the list below took its colour). No number
 * and no verdict appears on the card at all.
 */
export function EntryCard(props: {
  readonly entry: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  /** What day it is, so the header can say "today" of today. */
  readonly today: Date;
  readonly t: Translate;
  readonly onOpen: () => void;
  /** Whether the entry still has its audio; no icon at all while unknown. */
  readonly hasAudio?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const words = emotionWordsIn(props.entry.cleanTranscript, props.t);
  // The mood marks the entry; the emotion's name wears the one blue.
  const marker = moodTint(props.entry.mood?.value ?? null, theme);

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
        <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: marker }} />
        <AppText variant="secondary" color="inkSoft" style={{ fontSize: 13 }}>
          {`${dayWordOf(props.entry.createdAt, props.today, props.locale, props.t)} · ${timeOf(props.entry.createdAt, props.locale)}`}
        </AppText>
        {/* With its audio or without, beside the time (owner's word, 2026-10-13). */}
        {props.hasAudio === undefined ? null : (
          <View
            accessible
            accessibilityLabel={props.t(props.hasAudio ? 'feed.withAudio' : 'feed.withoutAudio')}
          >
            <Icon name={props.hasAudio ? 'mic' : 'mic-off'} size={14} color="inkFaint" />
          </View>
        )}
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="body" style={{ fontSize: 16, lineHeight: 23 }}>
          {props.entry.cleanTranscript}
        </AppText>
        {props.entry.emotionIds.length === 0 ? null : (
          <AppText variant="secondary" style={{ color: theme.palette.tag }}>
            {props.entry.emotionIds.map((id) => emotionLabel(id, words)).join(' · ')}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

function timeOf(date: Date, locale: Locale): string {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
