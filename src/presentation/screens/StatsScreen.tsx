import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { WeekSummary } from '@/application/use-cases/GetWeekSummary';
import type { MoodPattern } from '@/application/use-cases/FindMoodPatterns';
import type { Theme } from '@/application/use-cases/GetWeekThemes';
import { countedKey } from '@/i18n/plural';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { toneFor } from '../components/MoodScale';
import { Button } from '../components/Button';
import { RoundBack } from '../components/RoundBack';

import { useTheme } from '../theme/ThemeProvider';

/** Straight off the drawing, not rounded to a grid: the chart is 156 tall. */
const CHART_HEIGHT = 156;

/** A bar never grows past this, however wide the phone. */
const BAR_MAX_WIDTH = 26;

/** A day nobody wrote on: a dot on the baseline, never a short bar. */
const DOT = 5;

/** The steps, which stay in place greyed rather than disappearing. */
const STEP = 34;

/** Below this a week has too little in it for prose worth reading. */
const NARRATIVE_FROM_ENTRIES = 3;

const RING = { size: 124, radius: 42, width: 13 } as const;

export interface StatsView {
  readonly week: WeekSummary;
  readonly themes: readonly Theme[];
  /** Widest gap first. The card shows one; the rest are only counted. */
  readonly patterns: readonly MoodPattern[];
  /** How many weeks back this is. Zero is the current one. */
  readonly weeksBack: number;
  /** False when nothing was ever written before this week. */
  readonly hasEarlierWeek: boolean;
  /** True while the free week is running. The purchase after it is M5's. */
  readonly hasNarrativeAccess: boolean;
  /** True once the free week has been used up, so it stops being offered. */
  readonly trialSpent: boolean;
}

/**
 * The week that happened. The vocabulary that is changing is its own screen,
 * one link away, exactly as the drawing has it — they answer different
 * questions, and stacking them made the second read as a footnote to the first.
 *
 * **No headline number.** An average of feelings means nothing and reads as a
 * verdict. The entry count is not that: it says how much there is to read.
 */
export function StatsScreen(props: {
  readonly view: StatsView | null;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onBack: () => void;
  readonly onEarlierWeek: () => void;
  readonly onLaterWeek: () => void;
  readonly onOpenVocabulary: () => void;
  readonly onOpenDay: () => void;
  readonly onOpenSubscription: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { view, t } = props;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: 40 }}
    >
      <RoundBack t={t} onPress={props.onBack} />
      <PeriodHeader
        title={t(view === null || view.weeksBack === 0 ? 'stats.title' : 'stats.last')}
        range={view === null ? '' : rangeOf(view.week, props.locale)}
        canGoBack={view?.hasEarlierWeek ?? false}
        canGoForward={(view?.weeksBack ?? 0) > 0}
        backLabel={t('stats.previousWeek')}
        forwardLabel={t('stats.nextWeek')}
        onBack={props.onEarlierWeek}
        onForward={props.onLaterWeek}
      />

      {view === null ? null : view.week.entryCount === 0 ? (
        /* A quiet week is its own screen in the drawing, not an empty card. */
        <View style={{ marginTop: 44, gap: 26, alignItems: 'flex-start' }}>
          <AppText variant="lede" color="inkSoft">
            {t(view.weeksBack === 0 ? 'stats.quietWeek' : 'stats.quietPast')}
          </AppText>
          <Button label={t('stats.toHome')} onPress={props.onBack} />
        </View>
      ) : (
        <>
          <View style={{ height: 26 }} />
          <AppText variant="caption" color="inkFaint" style={{ marginBottom: 14 }}>
            {t('stats.moodByDay')}
          </AppText>
          <Chart week={view.week} locale={props.locale} onOpenDay={props.onOpenDay} />
          <Count count={view.week.entryCount} locale={props.locale} t={t} />
          <Narrative
            view={view}
            locale={props.locale}
            t={t}
            onOpenSubscription={props.onOpenSubscription}
          />
          <Pattern
            view={view}
            locale={props.locale}
            t={t}
            onOpenSubscription={props.onOpenSubscription}
          />
          <Themes themes={view.themes} locale={props.locale} t={t} />
          <Pressable accessibilityRole="button" onPress={props.onOpenVocabulary} hitSlop={12}>
            <AppText variant="body" color="inkSoft">
              {t('stats.dictLink')}
            </AppText>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

/**
 * Title, the period under it, and two steps that stay where they are when they
 * cannot be taken — greyed rather than gone. A control that disappears moves
 * everything beside it and leaves the person wondering whether they mis-tapped.
 *
 * Shared with the vocabulary screen, which wears the same header.
 */
export function PeriodHeader(props: {
  readonly title: string;
  readonly range: string;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly backLabel: string;
  readonly forwardLabel: string;
  readonly onBack: () => void;
  readonly onForward: () => void;
}): React.JSX.Element {
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <AppText variant="display">{props.title}</AppText>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Step
            glyph="‹"
            enabled={props.canGoBack}
            label={props.backLabel}
            onPress={props.onBack}
          />
          <Step
            glyph="›"
            enabled={props.canGoForward}
            label={props.forwardLabel}
            onPress={props.onForward}
          />
        </View>
      </View>
      {props.range.length === 0 ? null : (
        <AppText variant="secondary" color="inkSoft">
          {props.range}
        </AppText>
      )}
    </>
  );
}

function Step(props: {
  readonly glyph: string;
  readonly enabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const frame = {
    width: STEP,
    height: STEP,
    borderRadius: STEP,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (!props.enabled) {
    return (
      <View style={frame}>
        <AppText variant="body" color="inkFaint">
          {props.glyph}
        </AppText>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      hitSlop={8}
      style={[frame, { backgroundColor: theme.palette.paper }]}
    >
      <AppText variant="body">{props.glyph}</AppText>
    </Pressable>
  );
}

function Chart(props: {
  readonly week: WeekSummary;
  readonly locale: Locale;
  readonly onOpenDay: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 6,
        height: CHART_HEIGHT,
        marginBottom: 8,
      }}
    >
      {props.week.days.map((day) => (
        <View key={day.date.toISOString()} style={{ flex: 1, alignItems: 'center', gap: 9 }}>
          <View
            style={{ flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
          >
            {day.averageMood === null ? (
              <View
                accessibilityLabel={weekdayOf(day.date, props.locale)}
                style={{
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT,
                  backgroundColor: theme.palette.line,
                }}
              />
            ) : (
              <View
                accessibilityLabel={`${weekdayOf(day.date, props.locale)} ${String(day.averageMood)}`}
                style={{
                  width: '100%',
                  maxWidth: BAR_MAX_WIDTH,
                  borderRadius: 4,
                  // Five is the top of the scale, so a 4 stands four fifths tall.
                  height: `${(day.averageMood / 5) * 100}%`,
                  backgroundColor: theme.palette[toneFor(day.averageMood)],
                }}
              />
            )}
          </View>
          <AppText variant="caption" color="inkFaint">
            {weekdayOf(day.date, props.locale)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function Count(props: {
  readonly count: number;
  readonly locale: Locale;
  readonly t: Translate;
}): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 18 }}>
      <AppText variant="display">{String(props.count)}</AppText>
      <AppText variant="body" color="inkSoft">
        {props.t(countedKey('stats.weekCount', props.count, props.locale))}
      </AppText>
    </View>
  );
}

/**
 * A dark panel, and the first paragraph is free. Someone who has not paid still
 * reads something true about their own week; the lock takes the rest of it.
 * A paywall over the whole of a person's own week is the app holding their
 * words hostage, which §M5 does not allow.
 */
function Narrative(props: {
  readonly view: StatsView;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpenSubscription: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { week, hasNarrativeAccess } = props.view;

  /*
   * Two different silences, and lumping them together was a bug: a week with
   * six entries and no subscription was being told it had too little to read.
   * Too few entries is the only thing this line is about.
   */
  if (week.entryCount < NARRATIVE_FROM_ENTRIES) {
    return (
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.palette.line,
          paddingTop: 20,
          marginBottom: 26,
        }}
      >
        <AppText variant="body" color="inkSoft">
          {props.t('stats.proseLater')}
        </AppText>
      </View>
    );
  }

  const paragraphs = (week.narrative ?? '').split('\n').filter((line) => line.trim().length > 0);
  const shown = hasNarrativeAccess ? paragraphs : paragraphs.slice(0, 1);

  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: theme.palette.panel,
        padding: 22,
        marginBottom: 26,
        gap: 10,
      }}
    >
      <AppText variant="caption" style={{ color: theme.palette.onPanel, opacity: 0.6 }}>
        {props.t('stats.yourWeek')}
      </AppText>
      {shown.map((paragraph) => (
        <AppText key={paragraph} variant="quote" style={{ color: theme.palette.onPanel }}>
          {paragraph}
        </AppText>
      ))}
      {hasNarrativeAccess ? null : (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.palette.lineSoft,
            marginTop: 8,
            paddingTop: 16,
            gap: 14,
            alignItems: 'flex-start',
          }}
        >
          {/*
            Counted, never quoted. Naming the pattern here would be giving away
            the thing and then asking to be paid for it, and hiding the fact
            that there is one would be worse. When there is none, that is said
            too — silence would read as something being kept back.
          */}
          <AppText variant="secondary" style={{ color: theme.palette.onPanel, opacity: 0.7 }}>
            {props.view.patterns.length === 0
              ? props.t('stats.morePatternsNone')
              : props.t('stats.morePatterns', {
                  n: props.view.patterns.length,
                  w: props.t(
                    countedKey('stats.pattern', props.view.patterns.length, props.locale),
                  ),
                })}
          </AppText>
          {/*
            One button either way; the subscription screen is where the offer
            differs, because that is where the price is said out loud.
          */}
          <Button label={props.t('stats.readAll')} onPress={props.onOpenSubscription} />
          {props.view.trialSpent ? (
            <AppText variant="secondary" style={{ color: theme.palette.onPanel, opacity: 0.7 }}>
              {props.t('subs.trialOver')}
            </AppText>
          ) : null}
          {/*
            No price here. This panel is on the free screen and the store's
            numbers live one tap away, where they are the store's own and in
            the buyer's own currency.
          */}
        </View>
      )}
    </View>
  );
}

/**
 * One pattern, the widest one, and only for someone who is past the paywall.
 *
 * The sentence says two things happened together and stops there. Days with a
 * walk being better days does not mean the walk made them better, and §7.9
 * forbids Vidlun advising anyone to take one.
 */
function Pattern(props: {
  readonly view: StatsView;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpenSubscription: () => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const pattern = props.view.patterns[0];

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.palette.line,
        backgroundColor: theme.palette.paper,
        borderRadius: 22,
        padding: 20,
        marginBottom: 26,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Bulb colour={theme.palette.inkFaint} />
        <AppText variant="caption" color="inkFaint">
          {props.t('stats.patternTitle')}
        </AppText>
      </View>
      {pattern === undefined ? (
        /*
         * Shown to everyone, paid or not. A week with no pattern is a fact
         * about the week rather than something withheld, and an empty space
         * where the card was last week reads as something having broken.
         */
        <AppText variant="body" color="inkSoft">
          {props.t('stats.patternNoneBody')}
        </AppText>
      ) : props.view.hasNarrativeAccess ? (
        <AppText variant="body">
          {props.t(pattern.direction === 'higher' ? 'stats.patternHigher' : 'stats.patternLower', {
            tag: pattern.tag,
            n: pattern.occurrences,
            times: props.t(countedKey('stats.times', pattern.occurrences, props.locale)),
          })}
        </AppText>
      ) : (
        /*
         * Named as a thing that exists, never quoted. Telling someone there is
         * nothing here would be a lie; telling them what it says would be
         * giving away the one thing sold.
         */
        <Pressable accessibilityRole="button" onPress={props.onOpenSubscription} hitSlop={8}>
          <AppText variant="body" color="accentInk">
            {props.t('subs.patternLocked')}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

/** The drawing's own bulb, which Feather has no equal of. */
function Bulb(props: { readonly colour: string }): React.JSX.Element {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M12 3.4a6 6 0 0 1 3.5 10.9v1.6h-7v-1.6A6 6 0 0 1 12 3.4z"
        fill="none"
        stroke={props.colour}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M9.7 18.3h4.6M10.6 20.8h2.8"
        stroke={props.colour}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * A ring and a legend rather than bars: the question is what share of the week
 * each thing took. The words carry the meaning, the ring carries the
 * proportion, and both come from the person's own tags.
 */
function Themes(props: {
  readonly themes: readonly Theme[];
  readonly locale: Locale;
  readonly t: Translate;
}): React.JSX.Element | null {
  const theme = useTheme();

  if (props.themes.length === 0) {
    return null;
  }

  const total = props.themes.reduce((sum, each) => sum + each.entryCount, 0);
  const circumference = 2 * Math.PI * RING.radius;
  let travelled = 0;

  return (
    <View style={{ marginBottom: 28 }}>
      <AppText variant="caption" color="inkFaint" style={{ marginBottom: 14 }}>
        {props.t('stats.topicsTitle')}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
        <View style={{ width: RING.size, height: RING.size }}>
          <Svg width={RING.size} height={RING.size} viewBox="0 0 100 100">
            <Circle
              cx={50}
              cy={50}
              r={RING.radius}
              fill="none"
              stroke={theme.palette.skeleton}
              strokeWidth={RING.width}
            />
            {props.themes.map((each, at) => {
              const length = (each.entryCount / total) * circumference;
              const offset = -travelled;

              travelled += length;

              return (
                <Circle
                  key={each.tag}
                  cx={50}
                  cy={50}
                  r={RING.radius}
                  fill="none"
                  stroke={themeColour(theme.palette, at)}
                  strokeWidth={RING.width}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={offset}
                  // Twelve o'clock, so the first slice starts where a reader looks.
                  transform="rotate(-90 50 50)"
                />
              );
            })}
          </Svg>
          <View
            style={{
              position: 'absolute',
              width: RING.size,
              height: RING.size,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="kicker">{String(total)}</AppText>
            <AppText variant="caption" color="inkSoft">
              {props.t(countedKey('stats.mention', total, props.locale))}
            </AppText>
          </View>
        </View>
        <View style={{ flex: 1, gap: 11 }}>
          {props.themes.map((each, at) => (
            <View key={each.tag} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: themeColour(theme.palette, at),
                }}
              />
              <AppText variant="body">{each.tag}</AppText>
              <AppText variant="body" color="inkSoft" style={{ marginLeft: 'auto' }}>
                {String(each.entryCount)}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Themes are not feelings, so they take interface accents rather than the
 * emotion palette: an emotion colour here would say the week's topics had a
 * mood of their own.
 */
function themeColour(palette: ReturnType<typeof useTheme>['palette'], at: number): string {
  const wheel = [palette.accent, palette.warm, palette.lime];

  return wheel[at % wheel.length] ?? palette.accent;
}

function rangeOf(week: WeekSummary, locale: Locale): string {
  const last = new Date(week.weekEnd.getTime());

  last.setDate(last.getDate() - 1);

  const short: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

  return `${week.weekStart.toLocaleDateString(locale, short)} – ${last.toLocaleDateString(locale, short)}`;
}

function weekdayOf(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale, { weekday: 'short' });
}
