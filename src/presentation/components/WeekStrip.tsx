import { View } from 'react-native';

import type { DailyMood } from '@/application/use-cases/GetWeekSummary';
import type { Locale } from '@/i18n';

import { AppText } from './AppText';
import { moodTone } from './emotionTone';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Seven days ending today. A day that holds an entry gets a dot in its mood
 * colour; a day that does not gets an empty box.
 *
 * The empty box is the whole point of the strip. A missing day must never
 * render as a low mood — no short bar, no grey fill, nothing that could be
 * mistaken for "that day went badly". Not writing is not a state of mind.
 */
export function WeekStrip(props: {
  readonly week: readonly DailyMood[];
  readonly locale: Locale;
  readonly noEntryLabel: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {props.week.map((day, index) => {
        const isToday = index === props.week.length - 1;
        const tracked = day.averageMood !== null;
        const dot = tracked ? theme.palette[moodTone(day.averageMood ?? 0)] : theme.palette.line;

        return (
          <View
            key={day.date.toISOString()}
            style={{ flex: 1, alignItems: 'center', gap: theme.spacing.sm }}
            accessible
            accessibilityLabel={`${weekdayOf(day.date, props.locale)}, ${
              tracked ? String(day.entryCount) : props.noEntryLabel
            }`}
          >
            <AppText variant="label" color={isToday ? 'ink' : 'inkFaint'} style={{ fontSize: 12 }}>
              {weekdayOf(day.date, props.locale)}
            </AppText>
            <View
              style={{
                width: '100%',
                height: 34,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: isToday ? theme.palette.ink : theme.palette.line,
                backgroundColor: tracked ? theme.palette.paper : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
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
