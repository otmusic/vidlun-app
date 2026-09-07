import { Pressable, View } from 'react-native';

import type { YearEcho } from '@/application/use-cases/GetHomeView';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { emotionKey, type Locale, type Translate } from '@/i18n';

import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Playback } from './Playback';

/**
 * The drawing's card for a year ago today: the entry's own colour in the
 * dots, the day, the words, and — where the phone still has it — the voice,
 * playable without leaving home. Reading "I was anxious" and hearing your own
 * voice say it a year ago are two different things, and the second is what
 * a voice journal is for. Ink-bordered, unlike the monthly echo, because it
 * is an event and not furniture.
 */
export function YearEchoCard(props: {
  readonly echo: YearEcho;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpen: (entry: MoodEntry) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { entry } = props.echo;
  const first = entry.emotionIds[0];
  const emotion = first === undefined ? undefined : props.vocabulary.find(first);
  const colour =
    emotion === undefined
      ? theme.palette.line
      : colorForEmotion(props.vocabulary, emotion, theme.isDark ? 'dark' : 'light');

  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: theme.palette.ink,
        borderRadius: 22,
        backgroundColor: theme.palette.paper,
        paddingTop: 18,
        paddingHorizontal: 20,
        paddingBottom: 16,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: colour }} />
          <View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: colour, opacity: 0.55 }} />
          <View style={{ width: 3, height: 3, borderRadius: 3, backgroundColor: colour, opacity: 0.3 }} />
          <View style={{ width: 3, height: 3, borderRadius: 3, backgroundColor: colour, opacity: 0.18 }} />
        </View>
        <AppText variant="caption" style={{ fontSize: 11.5, fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>
          {`${props.t('home.yearAgo')} · ${dayOf(entry.createdAt, props.locale)}`}
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
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          props.onOpen(entry);
        }}
        style={{ marginBottom: 14 }}
      >
        <AppText variant="quote" numberOfLines={4} style={{ fontSize: 17, lineHeight: 25 }}>
          {entry.cleanTranscript}
        </AppText>
      </Pressable>
      {props.echo.recordingUri === null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Icon name="mic-off" size={15} color="inkFaint" />
          <AppText
            variant="caption"
            color="inkFaint"
            style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, lineHeight: 19, flexShrink: 1 }}
          >
            {props.t('home.yearNoVoice')}
          </AppText>
        </View>
      ) : (
        <Playback uri={props.echo.recordingUri} t={props.t} variant="inline" />
      )}
    </View>
  );
}

/**
 * The day with its year, as the drawing writes it. Assembled from the day and
 * the bare year rather than one locale call, which in Ukrainian appends an
 * abbreviation after the number that the drawing does not carry.
 */
function dayOf(date: Date, locale: Locale): string {
  const day = date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  return `${day} ${String(date.getFullYear())}`;
}
