import { View } from 'react-native';

import type { DailyMood } from '@/application/use-cases/GetWeekSummary';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { Locale } from '@/i18n';

import { AppText } from './AppText';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Seven days ending today, each painted in the colour of the emotion named
 * most that day — the drawing colours days by what they held, not by how the
 * number scored. A day with nothing in it is ink: an outline, a neutral dot,
 * and no colour to mistake for a feeling.
 */
export function WeekStrip(props: {
  readonly week: readonly DailyMood[];
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly noEntryLabel: string;
}): React.JSX.Element {
  const theme = useTheme();
  const scheme = theme.isDark ? 'dark' : 'light';

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {props.week.map((day) => {
        const emotion =
          day.topEmotionId === null ? undefined : props.vocabulary.find(day.topEmotionId);
        const colour =
          emotion === undefined ? null : colorForEmotion(props.vocabulary, emotion, scheme);

        return (
          <View
            key={day.date.toISOString()}
            style={{ flex: 1, alignItems: 'center', gap: theme.spacing.sm }}
            accessible
            accessibilityLabel={`${weekdayOf(day.date, props.locale)}, ${
              day.entryCount > 0 ? String(day.entryCount) : props.noEntryLabel
            }`}
          >
            <AppText
              variant="label"
              style={{ fontSize: 12, color: colour ?? theme.palette.ink }}
            >
              {weekdayOf(day.date, props.locale)}
            </AppText>
            <View
              style={{
                width: '100%',
                height: 34,
                borderRadius: 12,
                borderWidth: 1.5,
                /* The drawing's own arithmetic: a third of the colour for the
                   ring, an eighth for the fill. */
                borderColor: colour === null ? theme.palette.ink : `${colour}55`,
                backgroundColor: colour === null ? 'transparent' : `${colour}1F`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colour ?? theme.palette.ink,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function weekdayOf(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale, { weekday: 'short' });
}
