import { Pressable, ScrollView, View } from 'react-native';

import type { HomeView } from '@/application/use-cases/GetHomeView';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { Icon, ICON_SIZE } from '../components/Icon';
import { RecordButton } from '../components/RecordButton';
import { WeekStrip } from '../components/WeekStrip';
import { useTheme } from '../theme/ThemeProvider';

export interface HomeScreenProps {
  readonly home: HomeView | null;
  readonly locale: Locale;
  readonly onDelete: (id: string) => void;
  readonly onOpenHistory: () => void;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly t: Translate;
  readonly onRecord: () => void;
  readonly onWrite: () => void;
}

export function HomeScreen(props: HomeScreenProps): React.JSX.Element {
  const theme = useTheme();
  const streak = props.home?.streakDays ?? 0;
  const recent = props.home?.recentEntries ?? [];
  const week = props.home?.week ?? [];

  /*
   * Home scrolls. It used to be a fixed column with the record button in a
   * flex:1 middle, which held only while the recent list was short — the
   * moment it filled, the middle was squeezed and the button climbed over the
   * question. Nothing here competes for height any more: every block is its
   * own size and the page moves under them.
   */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: 118 }}
    >
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
        {/*
          * Nothing but the run of days sits opposite the date. Settings moved to
          * its own tab, and a gear here would be the only control on the screen
          * competing with the one the screen exists for.
          *
          * At zero the pill is absent rather than showing a nought. A person on
          * their first day has not failed at anything, and a counter that opens
          * at zero is the app saying otherwise.
          */}
        {streak > 0 ? <StreakPill days={streak} label={props.t('home.streakUnit')} /> : null}
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

      <View style={{ alignItems: 'center', gap: 18, paddingTop: 16, paddingBottom: 34 }}>
        <RecordButton onPress={props.onRecord} accessibilityLabel={props.t('home.recordHint')} />
        <AppText variant="body" color="inkSoft">
          {props.t('home.recordHint')}
        </AppText>
        {/*
          * hitSlop rather than a 44pt box: a padded target here would push the
          * text off the line the design puts it on. The finger still lands on
          * 44, the layout does not know about it.
          */}
        <Pressable
          accessibilityRole="button"
          onPress={props.onWrite}
          hitSlop={14}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 }}
        >
          <Icon name="edit-3" size={ICON_SIZE.glyph} color="inkFaint" />
          <AppText variant="secondary" color="inkFaint">
            {props.t('home.writeInstead')}
          </AppText>
        </Pressable>
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
            <Pressable accessibilityRole="button" onPress={props.onOpenHistory} hitSlop={16}>
              <AppText variant="secondary" color="accent">
                {props.t('home.openHistory')}
              </AppText>
            </Pressable>
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
    </ScrollView>
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
