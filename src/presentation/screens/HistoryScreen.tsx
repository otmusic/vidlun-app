import { ScrollView, View } from 'react-native';

import type { HistoryDay } from '@/application/use-cases/GetHistory';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { BackButton } from '../components/BackButton';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

export function HistoryScreen(props: {
  readonly days: readonly HistoryDay[] | null;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly onDelete: (id: string) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen>
      <BackButton t={props.t} onPress={props.onBack} />
      <AppText variant="display">{props.t('history.title')}</AppText>

      {props.days !== null && props.days.length === 0 ? (
        <AppText variant="secondary" color="inkFaint" style={{ marginTop: theme.spacing.md }}>
          {props.t('history.empty')}
        </AppText>
      ) : (
        <SwipeGroup>
          <ScrollView
            style={{ flex: 1, marginTop: theme.spacing.md }}
            contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {(props.days ?? []).map((day) => (
              <View key={day.day.toISOString()} style={{ marginBottom: theme.spacing.md }}>
                <AppText variant="caption" color="inkFaint">
                  {dayLabel(day.day, props.locale, props.t)}
                </AppText>
                {day.entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    t={props.t}
                    onOpen={props.onOpen}
                    onDelete={props.onDelete}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </SwipeGroup>
      )}
    </Screen>
  );
}

/**
 * The two most recent days are named rather than dated. Reading "25 August"
 * about this morning makes your own week feel like someone else's records.
 */
function dayLabel(day: Date, locale: Locale, t: Translate): string {
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysBack = Math.round((midnight.getTime() - day.getTime()) / 86_400_000);

  if (daysBack === 0) {
    return t('history.today');
  }

  if (daysBack === 1) {
    return t('history.yesterday');
  }

  return day.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'long',
  });
}
