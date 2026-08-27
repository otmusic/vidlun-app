import { View } from 'react-native';

import type { HomeView } from '@/application/use-cases/GetHomeView';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { TapTarget } from '../components/Button';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { Icon, ICON_SIZE } from '../components/Icon';
import { Orb } from '../components/Orb';
import { WeekStrip } from '../components/WeekStrip';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

export interface HomeScreenProps {
  readonly home: HomeView | null;
  readonly locale: Locale;
  readonly onDelete: (id: string) => void;
  readonly onOpenHistory: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly t: Translate;
  readonly onRecord: () => void;
  readonly onWrite: () => void;
}

const RECORD_BUTTON = 152;

export function HomeScreen(props: HomeScreenProps): React.JSX.Element {
  const theme = useTheme();
  const streak = props.home?.streakDays ?? 0;
  const recent = props.home?.recentEntries ?? [];
  const week = props.home?.week ?? [];

  return (
    <Screen inset={{ top: 70, sides: 22, bottom: 40 }} style={{ gap: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <AppText variant="caption" color="inkFaint">
          {formatToday(props.locale)}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {streak > 0 ? <StreakPill days={streak} label={props.t('home.streakUnit')} /> : null}
          <TapTarget onPress={props.onOpenSettings} accessibilityLabel={props.t('home.openSettings')}>
            <Icon name="settings" size={ICON_SIZE.action} />
          </TapTarget>
        </View>
      </View>

      {week.length > 0 ? (
        <WeekStrip
          week={week}
          locale={props.locale}
          noEntryLabel={props.t('home.noEntryThatDay')}
        />
      ) : null}

      <AppText variant="display" style={{ marginTop: 22 }}>
        {props.t('home.prompt')}
      </AppText>

      {/* The primary action sits in the thumb zone, never at the top. */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          paddingTop: 16,
          paddingBottom: 34,
        }}
      >
        <Orb
          mode="idle"
          size={RECORD_BUTTON}
          onPress={props.onRecord}
          accessibilityLabel={props.t('home.recordHint')}
        />
        <AppText variant="body" color="inkSoft">
          {props.t('home.recordHint')}
        </AppText>
        <TapTarget onPress={props.onWrite} accessibilityLabel={props.t('home.writeInstead')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Icon name="edit-3" size={ICON_SIZE.glyph} color="inkFaint" />
            <AppText variant="secondary" color="inkFaint">
              {props.t('home.writeInstead')}
            </AppText>
          </View>
        </TapTarget>
      </View>

      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 6,
          }}
        >
          <AppText variant="caption" color="inkFaint">
            {props.t('home.recentTitle')}
          </AppText>
          {recent.length > 0 ? (
            <TapTarget onPress={props.onOpenHistory} accessibilityLabel={props.t('home.openHistory')}>
              <AppText variant="secondary" color="accent">
                {props.t('home.openHistory')}
              </AppText>
            </TapTarget>
          ) : null}
        </View>
        {recent.length === 0 ? (
          <AppText variant="body" color="inkFaint">
            {props.t('home.emptyState')}
          </AppText>
        ) : (
          <SwipeGroup>
            <View style={{ gap: 12 }}>
              {recent.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  t={props.t}
                  onOpen={props.onOpen}
                  onDelete={props.onDelete}
                />
              ))}
            </View>
          </SwipeGroup>
        )}
      </View>
    </Screen>
  );
}

/**
 * The one place a number is allowed to look like an achievement. It stays a
 * quiet fill rather than the accent: the accent means "Vidlun is speaking",
 * and a streak is the person's own doing.
 */
function StreakPill(props: { readonly days: number; readonly label: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: theme.palette.limeSoft,
        borderRadius: theme.radii.pill,
        paddingVertical: 6,
        paddingLeft: 10,
        paddingRight: 12,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.palette.accent }} />
      <AppText variant="numeric" style={{ fontSize: 14 }}>
        {String(props.days)}
      </AppText>
      <AppText variant="secondary" color="inkSoft" style={{ fontSize: 12 }}>
        {props.label}
      </AppText>
    </View>
  );
}

function formatToday(locale: Locale): string {
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}
