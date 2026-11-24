import { Pressable, Text, View } from 'react-native';

import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { SearchQuery } from '@/domain/value-objects/SearchQuery';
import { type Locale, type Translate } from '@/i18n';

import { AppText } from './AppText';
import { dayWordOf } from './dayWord';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, emotionWordsIn, moodTint } from './emotionDisplay';
import { snippetOf } from '../screens/journalSearch';

/**
 * A dot in the entry's own colour, the day and time, the sentence, and the
 * emotions under it in the one blue (owner's word, 2026-11-16: the first
 * emotion at the top right went, the list below took its colour). Under them
 * the entry's topics as small grey chips, the shape topics have on the
 * entry's page and in the filter (owner's word, 2026-11-24, canvas variant
 * C); a tap on one narrows the journal to it. No number and no verdict
 * appears on the card at all.
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
  /**
   * The journal's search, when the card is one of its results: the card
   * shows the sentence the word is in, with the word lit (owner's word,
   * 2026-11-20), instead of the entry's opening.
   */
  readonly found?: SearchQuery | null;
  /** A topic tapped: the journal narrowed to it. */
  readonly onTopic?: (topic: string) => void;
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
        {props.found === undefined || props.found === null ? (
          <AppText variant="body" style={{ fontSize: 16, lineHeight: 23 }}>
            {props.entry.cleanTranscript}
          </AppText>
        ) : (
          <AppText variant="body" numberOfLines={3} style={{ fontSize: 16, lineHeight: 23 }}>
            {snippetOf(props.entry.cleanTranscript, props.found).map((piece, at) =>
              piece.found ? (
                <Text key={at} style={{ backgroundColor: theme.palette.accentSoft }}>
                  {piece.text}
                </Text>
              ) : (
                piece.text
              ),
            )}
          </AppText>
        )}
        {props.entry.emotionIds.length === 0 ? null : (
          <AppText variant="secondary" style={{ color: theme.palette.tag }}>
            {props.entry.emotionIds.map((id) => emotionLabel(id, words)).join(' · ')}
          </AppText>
        )}
        {props.entry.contextTags.length === 0 ? null : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {props.entry.contextTags.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityHint={props.t('feed.byTopic')}
                disabled={props.onTopic === undefined}
                onPress={() => {
                  props.onTopic?.(tag);
                }}
                // A small pill with a finger-sized reach (§7.3).
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: theme.palette.lineStrong,
                  borderRadius: 999,
                  paddingVertical: 2,
                  paddingHorizontal: 10,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <AppText variant="secondary" color="inkSoft" style={{ fontSize: 13, lineHeight: 19 }}>
                  {tag}
                </AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function timeOf(date: Date, locale: Locale): string {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
