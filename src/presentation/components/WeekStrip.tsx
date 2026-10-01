import { View } from 'react-native';

import type { DailyMood } from '@/application/use-cases/GetWeekSummary';
import type { Milestone } from '@/domain/entities/Milestone';
import type { Locale } from '@/i18n';

import { AppText } from './AppText';
import { toneFor } from './emotionTone';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Seven days ending today, each painted in its mood's colour — the band the
 * day's average falls in on the mood scale (owner's word, 2026-10-01: entries
 * are marked by mood, feelings are all one blue). A day with nothing in it is
 * ink: an outline, a neutral dot, and no colour to mistake for a mood.
 */
export function WeekStrip(props: {
  readonly week: readonly DailyMood[];
  readonly locale: Locale;
  readonly noEntryLabel: string;
  /** Days with a milestone carry the drawing's small ink tick under the box. */
  readonly milestones?: readonly Milestone[];
}): React.JSX.Element {
  const theme = useTheme();
  const milestones = props.milestones ?? [];

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {props.week.map((day) => {
        const colour =
          day.averageMood === null ? null : theme.palette[toneFor(day.averageMood)];

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
            {milestones.some((milestone) => milestone.marks(day.date)) ? (
              <View
                style={{
                  width: 1.5,
                  height: 8,
                  marginTop: -3,
                  borderRadius: 1,
                  backgroundColor: theme.palette.ink,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function weekdayOf(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale, { weekday: 'short' });
}
