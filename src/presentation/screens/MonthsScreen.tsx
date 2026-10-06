import { Pressable, ScrollView, View } from 'react-native';

import type { PastMonth } from '@/application/use-cases/GetPastMonths';
import type { Locale, Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { RoundBack } from '../components/RoundBack';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Every past month there is something to read about, newest first, behind
 * "Your months" on the statistics screen (owner's word, 2026-10-06). Home's
 * card shows the month just ended for a week; here it, and every month
 * before it, can be opened again. Someone without the narrative is taken to
 * the plans from a month, as from the card.
 */
export function MonthsScreen(props: {
  /** Null while they are counted. */
  readonly months: readonly PastMonth[] | null;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onBack: () => void;
  readonly onOpen: (monthStart: Date) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: 40, gap: 14 }}
    >
      <RoundBack t={props.t} onPress={props.onBack} />
      <AppText variant="display" style={{ marginTop: 12, marginBottom: 12 }}>
        {props.t('months.title')}
      </AppText>
      {props.months === null ? null : props.months.length === 0 ? (
        <AppText variant="lede" color="inkSoft">
          {props.t('months.empty')}
        </AppText>
      ) : (
        props.months.map((month) => (
          <MonthRow
            key={month.monthStart.getTime()}
            month={month}
            locale={props.locale}
            t={props.t}
            onOpen={props.onOpen}
          />
        ))
      )}
    </ScrollView>
  );
}

function MonthRow(props: {
  readonly month: PastMonth;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpen: (monthStart: Date) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const title = monthTitle(props.month.monthStart, props.locale);
  const count = `${props.month.entryCount} ${props.t(countedKey('feed.entry', props.month.entryCount, props.locale))}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count}`}
      onPress={() => {
        props.onOpen(props.month.monthStart);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.palette.line,
        backgroundColor: theme.palette.paper,
        paddingVertical: 20,
        paddingHorizontal: 22,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="kicker" style={{ fontSize: 21 }}>
          {title}
        </AppText>
        <AppText variant="secondary" color="inkSoft">
          {count}
        </AppText>
      </View>
      <AppText variant="body" color="inkFaint">
        ›
      </AppText>
    </Pressable>
  );
}

/** The month's own name, capitalised, and its year: a list can span more than one. */
function monthTitle(start: Date, locale: Locale): string {
  const name = start.toLocaleDateString(locale, { month: 'long' });

  return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)} ${start.getFullYear()}`;
}
