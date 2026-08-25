import { View } from 'react-native';

import type { HomeView } from '@/application/use-cases/GetHomeView';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { TapTarget } from '../components/Button';
import { Chip } from '../components/Chip';
import { Orb } from '../components/Orb';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { Icon, ICON_SIZE } from '../components/Icon';
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

export function HomeScreen(props: HomeScreenProps): React.JSX.Element {
  const theme = useTheme();
  const streak = props.home?.streakDays ?? 0;
  const recent = props.home?.recentEntries ?? [];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="secondary" color="inkSoft">
          {formatToday(props.locale)}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {streak > 0 ? <Chip label={props.t('home.streak', { count: streak })} tone="warm" /> : null}
          <TapTarget onPress={props.onOpenSettings} accessibilityLabel={props.t('home.openSettings')}>
            <Icon name="settings" size={ICON_SIZE.action} />
          </TapTarget>
        </View>
      </View>

      <AppText variant="display" style={{ marginTop: theme.spacing.md }}>
        {props.t('home.prompt')}
      </AppText>

      {/* The primary action sits in the thumb zone, never at the top. */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}>
        <Orb mode="idle" onPress={props.onRecord} accessibilityLabel={props.t('home.recordHint')} />
        <AppText variant="secondary" color="inkFaint">
          {props.t('home.recordHint')}
        </AppText>
        <TapTarget onPress={props.onWrite} accessibilityLabel={props.t('home.writeInstead')}>
          <Icon name="edit-3" size={ICON_SIZE.glyph} />
        </TapTarget>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: theme.palette.line, paddingTop: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="caption" color="inkFaint">
            {props.t('home.recentTitle')}
          </AppText>
          {recent.length > 0 ? (
            <TapTarget onPress={props.onOpenHistory} accessibilityLabel={props.t('home.openHistory')}>
              <AppText variant="caption" color="accent">
                {props.t('home.openHistory')}
              </AppText>
            </TapTarget>
          ) : null}
        </View>
        {recent.length === 0 ? (
          <AppText variant="secondary" color="inkFaint" style={{ marginTop: theme.spacing.sm }}>
            {props.t('home.emptyState')}
          </AppText>
        ) : (
          <SwipeGroup>
            {recent.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                t={props.t}
                onOpen={props.onOpen}
                onDelete={props.onDelete}
              />
            ))}
            {/*
              * Hold rather than swipe. Deleting an entry cannot be undone, and
              * a gesture people make by accident while scrolling their own
              * journal is the wrong one for that.
              */}
          </SwipeGroup>
        )}
      </View>
    </Screen>
  );
}

function formatToday(locale: Locale): string {
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
}

