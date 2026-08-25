import { Alert, Pressable, ScrollView, View } from 'react-native';
/*
 * The legacy Swipeable, on React Native's own Animated. The Reanimated one is
 * the newer path but pulls in react-native-reanimated, a second native
 * dependency and a babel plugin, for a single row animation.
 */
import Swipeable from 'react-native-gesture-handler/Swipeable';

import type { HistoryDay } from '@/application/use-cases/GetHistory';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Icon, ICON_SIZE } from '../components/Icon';
import { moodTone } from '../components/emotionTone';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/** §7.3: a list row is never smaller than this, whatever it holds. */
const ROW_HEIGHT = 52;

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
      <AppText variant="display">{props.t('history.title')}</AppText>

      {props.days !== null && props.days.length === 0 ? (
        <AppText variant="secondary" color="inkFaint" style={{ marginTop: theme.spacing.md }}>
          {props.t('history.empty')}
        </AppText>
      ) : (
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
                <HistoryRow
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
      )}

      <Button label={props.t('history.back')} variant="ghost" onPress={props.onBack} />
    </Screen>
  );
}

function HistoryRow(props: {
  readonly entry: MoodEntry;
  readonly t: Translate;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly onDelete: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { entry, t, onOpen, onDelete } = props;

  const confirm = (): void => {
    Alert.alert(t('delete.title'), t('delete.body'), [
      { text: t('delete.cancel'), style: 'cancel' },
      { text: t('delete.confirm'), style: 'destructive', onPress: () => onDelete(entry.id) },
    ]);
  };

  return (
    /*
     * The swipe reveals rather than deletes, and the button behind it still
     * asks. Three deliberate acts for something with no undo — a single swipe
     * that removed an entry would be the wrong gesture for a journal people
     * scroll through.
     */
    <Swipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable
          onPress={confirm}
          accessibilityLabel={t('delete.confirm')}
          style={{
            width: 76,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.palette.low,
            borderRadius: theme.radii.card,
            marginLeft: theme.spacing.sm,
          }}
        >
          <Icon name="trash-2" size={ICON_SIZE.action} color="onAccent" />
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onOpen(entry)}
        onLongPress={confirm}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: ROW_HEIGHT,
          backgroundColor: theme.palette.canvas,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.palette[moodTone(entry.mood.value)],
          }}
        />
        <AppText variant="secondary" color="inkSoft" numberOfLines={2} style={{ flex: 1 }}>
          {entry.cleanTranscript}
        </AppText>
      </Pressable>
    </Swipeable>
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
