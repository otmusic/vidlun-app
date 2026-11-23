import { ScrollView, View } from 'react-native';

import type { PlayableMonth } from '@/application/use-cases/ComposeMonthVoice';
import type { MonthSummary } from '@/application/use-cases/GetMonthSummary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { MonthVoice, MonthVoiceMode } from '@/domain/entities/MonthVoice';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { MonthVoicePlayer } from '../components/MonthVoicePlayer';
import { RoundBack } from '../components/RoundBack';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A month written back: the one just ended behind home's card, any earlier
 * one from the list of past months (owner's word, 2026-10-06). The card's own
 * two lines, then the prose. Only someone who can read it is brought here;
 * everyone else is taken to the plans.
 *
 * Under the prose, the month heard in its own voice (owner's word,
 * 2026-11-23), when any of its entries kept a voice.
 */
export function MonthScreen(props: {
  /** Null for the moment its shape is read. */
  readonly month: MonthSummary | null;
  readonly locale: Locale;
  /** Today, so a month from another year says which year. */
  readonly today: Date;
  readonly t: Translate;
  /** The month's voice, or null while it is gathered and when there is none to hear. */
  readonly voice: MonthVoice | null;
  readonly composeVoice: (voice: MonthVoice, mode: MonthVoiceMode) => Promise<PlayableMonth | null>;
  readonly onOpenEntry: (entry: MoodEntry) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: 40, gap: 26 }}
    >
      <RoundBack t={props.t} onPress={props.onBack} />
      {props.month === null ? null : (
        <MonthPanel month={props.month} locale={props.locale} today={props.today} t={props.t} />
      )}
      {props.month === null || props.voice === null ? null : (
        <MonthVoicePlayer
          voice={props.voice}
          locale={props.locale}
          t={props.t}
          title={props.t('home.monthKicker', {
            month: monthNameOf(props.month.monthStart, props.locale, props.today),
          })}
          compose={props.composeVoice}
          onOpenEntry={props.onOpenEntry}
        />
      )}
    </ScrollView>
  );
}

/**
 * The month in the dark clothes it wore on the statistics screen, opening as
 * home's card does: the month's kicker over home's lead, in the same measures.
 * The text, or the writing ghosts while it is being written.
 */
function MonthPanel(props: {
  readonly month: MonthSummary;
  readonly locale: Locale;
  readonly today: Date;
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();
  const monthName = monthNameOf(props.month.monthStart, props.locale, props.today);
  const paragraphs = (props.month.narrative ?? '')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: theme.palette.panel,
        paddingVertical: 20,
        paddingHorizontal: 22,
        gap: 10,
      }}
    >
      <AppText variant="caption" style={{ color: theme.palette.onPanel, opacity: 0.6 }}>
        {props.t('home.monthKicker', { month: monthName })}
      </AppText>
      <AppText variant="kicker" style={{ color: theme.palette.onPanel, fontSize: 21 }}>
        {props.t('home.monthLead')}
      </AppText>
      {props.month.narrative === null ? (
        <View style={{ gap: 9 }}>
          <AppText variant="body" style={{ color: theme.palette.onPanel, opacity: 0.65 }}>
            {props.t('stats.proseWriting')}
          </AppText>
          {/* Ghost lines where the paragraphs will land, so the panel does not jump when they do. */}
          {(['100%', '86%', '62%'] as const).map((width) => (
            <View
              key={width}
              style={{
                height: 15,
                width,
                borderRadius: 7,
                backgroundColor: 'rgba(255,255,255,0.10)',
              }}
            />
          ))}
        </View>
      ) : (
        paragraphs.map((paragraph) => (
          <AppText key={paragraph} variant="quote" style={{ color: theme.palette.onPanel }}>
            {paragraph}
          </AppText>
        ))
      )}
    </View>
  );
}

/** The month's name, with its year when it is not this year's. */
function monthNameOf(start: Date, locale: Locale, today: Date): string {
  const name = start.toLocaleDateString(locale, { month: 'long' });

  return start.getFullYear() === today.getFullYear() ? name : `${name} ${start.getFullYear()}`;
}
