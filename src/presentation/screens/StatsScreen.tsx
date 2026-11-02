import { BlurView } from 'expo-blur';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { WeekSummary } from '@/application/use-cases/GetWeekSummary';
import type {
  CompanionPattern,
  DaysPattern,
  MoodPattern,
} from '@/application/use-cases/FindMoodPatterns';
import type { Theme } from '@/application/use-cases/GetWeekThemes';
import { countedKey } from '@/i18n/plural';
import type { Milestone } from '@/domain/entities/Milestone';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { toneFor } from '../components/emotionTone';
import { Button } from '../components/Button';
import { Icon, ICON_SIZE } from '../components/Icon';
import { RoundBack } from '../components/RoundBack';

import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel } from '../components/emotionDisplay';
import type { JournalFocus } from './journalFilter';
import { topicsSection } from './weekTopics';

/** Straight off the drawing, not rounded to a grid: the chart is 156 tall. */
const CHART_HEIGHT = 156;

/** A bar never grows past this, however wide the phone. */
const BAR_MAX_WIDTH = 26;

/** A day nobody wrote on: a dot on the baseline, never a short bar. */
const DOT = 5;

/** The steps, which stay in place greyed rather than disappearing. */
const STEP = 34;

const RING = { size: 124, radius: 42, width: 13 } as const;

export interface StatsView {
  readonly week: WeekSummary;
  readonly themes: readonly Theme[];
  /** At most two: the month's best or hardest days, then a topic's emotion. */
  readonly patterns: readonly MoodPattern[];
  /** How many weeks back this is. Zero is the current one. */
  readonly weeksBack: number;
  /**
   * Where the arrows lead, in weeks back: the nearest week with entries on
   * either side, or null where the arrow leads nowhere.
   */
  readonly earlierWeeksBack: number | null;
  readonly laterWeeksBack: number | null;
  /** True while a plan or its free days are running. The store decides. */
  readonly hasNarrativeAccess: boolean;
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
  /** Every past month, each written back (owner's word, 2026-10-06). */
  readonly onOpenMonths: () => void;
  readonly onOpenDay: () => void;
  readonly onOpenSubscription: () => void;
  /** Opens the journal on a pattern's days (owner's word, 2026-10-14). */
  readonly onOpenEntries: (focus: JournalFocus) => void;
  /**
   * Every milestone; the chart marks the week's. The list and "mark an event"
   * left this screen on 2026-09-30 (owner's word): events wait for a better
   * home, and until then they are made nowhere and only shown.
   */
  readonly milestones: readonly Milestone[];
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const { view, t } = props;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: 40 }}
    >
      <RoundBack t={t} onPress={props.onBack} />
      {/* "Your week" over the week's dates (owner's word, 2026-10-14); the
          dates alone had been the title since 2026-09-22. */}
      <PeriodHeader
        title={t('stats.yourWeek')}
        range={view === null ? '' : rangeOf(view.week, props.locale)}
        canGoBack={(view?.earlierWeeksBack ?? null) !== null}
        canGoForward={(view?.laterWeeksBack ?? null) !== null}
        backLabel={t('stats.previousWeek')}
        forwardLabel={t('stats.nextWeek')}
        onBack={props.onEarlierWeek}
        onForward={props.onLaterWeek}
      />

      {view === null ? null : view.week.entryCount === 0 ? (
        /* A quiet week is its own screen in the drawing, not an empty card.
           No home button under it (owner's word, 2026-10-13): the back
           arrow above already goes there. */
        <View style={{ marginTop: 44 }}>
          <AppText variant="lede" color="inkSoft">
            {t(view.weeksBack === 0 ? 'stats.quietWeek' : 'stats.quietPast')}
          </AppText>
        </View>
      ) : (
        <>
          <View style={{ height: 26 }} />
          <AppText variant="caption" color="inkFaint" style={{ marginBottom: 14 }}>
            {t('stats.moodByDay')}
          </AppText>
          <Chart
            week={view.week}
            milestones={props.milestones}
            locale={props.locale}
            onOpenDay={props.onOpenDay}
          />
          {/* The week's own prose went on 2026-10-01 (owner's word): the month
              says it, on home and the page behind its card. The entry count
              under the chart went the same day. */}
          <View style={{ height: 26 }} />
          <Pattern
            view={view}
            locale={props.locale}
            t={t}
            onOpenSubscription={props.onOpenSubscription}
            onOpenEntries={props.onOpenEntries}
          />
          {topicsSection(view) === 'open' ? (
            <Themes themes={view.themes} locale={props.locale} t={t} />
          ) : topicsSection(view) === 'locked' ? (
            <TopicsLocked t={t} onOpenSubscription={props.onOpenSubscription} />
          ) : null}
        </>
      )}

      {/*
        * The ways on to the longer views, under any week, a quiet one too:
        * a Monday with nothing in it yet must not hide the months.
        */}
      {view === null ? null : (
        <View style={{ gap: 10, marginTop: view.week.entryCount === 0 ? 34 : 0 }}>
          <Button label={t('stats.dictLink')} variant="secondary" onPress={props.onOpenVocabulary} />
          <Button label={t('stats.monthsLink')} variant="secondary" onPress={props.onOpenMonths} />
        </View>
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
        {/* Wraps before it runs under the arrows: the Ukrainian "last week"
            is a display line and a half at the phone's width. */}
        <AppText variant="display" style={{ flex: 1, marginRight: 12 }}>
          {props.title}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 6, flexShrink: 0 }}>
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
  readonly milestones: readonly Milestone[];
  readonly locale: Locale;
  readonly onOpenDay: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  /* The drawing's milestone: a label above the day and a hairline down through its bar. */
  const marked = props.week.days.map((day) => props.milestones.find((m) => m.marks(day.date)) ?? null);

  return (
    <>
    {marked.some((m) => m !== null) ? (
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
        {marked.map((milestone, at) => (
          <AppText
            key={at}
            variant="secondary"
            align="center"
            style={{ flex: 1, fontSize: 11, lineHeight: 13, fontWeight: '500' }}
          >
            {milestone?.label ?? ''}
          </AppText>
        ))}
      </View>
    ) : null}
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 6,
        height: CHART_HEIGHT,
        marginBottom: 8,
      }}
    >
      {props.week.days.map((day, at) => (
        <View key={day.date.toISOString()} style={{ flex: 1, alignItems: 'center', gap: 9 }}>
          <View
            style={{ flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
          >
            {marked[at] === null ? null : (
              <View
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: -6,
                  width: 1,
                  marginLeft: -0.5,
                  backgroundColor: theme.palette.ink,
                  opacity: 0.6,
                }}
              />
            )}
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
    </>
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
  readonly onOpenEntries: (focus: JournalFocus) => void;
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
        <PatternWords
          patterns={props.view.patterns}
          monthStart={props.view.week.weekStart}
          locale={props.locale}
          t={props.t}
          onOpenEntries={props.onOpenEntries}
        />
      ) : (
        /*
         * Named as a thing that exists, never quoted. Lines the length of two
         * sentences stand where the words would be, under the same glass and
         * lock as the locked topics (owner's word, 2026-10-23), so the card
         * says plainly that a subscription opens it without a word of the
         * person's week behind the blur.
         */
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.t('subs.patternLocked')}
          onPress={props.onOpenSubscription}
          style={{
            // Out to the card's edges, so the glass reads as the card's lower
            // half rather than a grey box floating inside it.
            marginHorizontal: -20,
            marginBottom: -20,
            borderBottomLeftRadius: 21,
            borderBottomRightRadius: 21,
            overflow: 'hidden',
          }}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ gap: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 }}
          >
            {LOCKED_LINES.map((width) => (
              <View
                key={width}
                style={{
                  height: 12,
                  width,
                  borderRadius: 6,
                  backgroundColor: theme.palette.inkFaint,
                  opacity: 0.45,
                }}
              />
            ))}
          </View>
          <LockOverlay label={props.t('subs.patternLocked')} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * The month's pattern in two sentences at most (owner's word, 2026-10-14):
 * what its best or hardest days had in common, then the emotion that kept a
 * topic company — the first sentence's topic when it has one, so the second
 * reads as its continuation. Under them, the way to those days in the journal.
 *
 * The month is named in the sentence because the week on screen may belong to
 * an earlier one, and "this month" would then be wrong.
 */
function PatternWords(props: {
  readonly patterns: readonly MoodPattern[];
  readonly monthStart: Date;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpenEntries: (focus: JournalFocus) => void;
}): React.JSX.Element {
  const { t } = props;
  const days = props.patterns.find((each): each is DaysPattern => each.kind === 'days');
  const companion = props.patterns.find(
    (each): each is CompanionPattern => each.kind === 'companion',
  );
  const name = props.monthStart.toLocaleDateString(props.locale, { month: 'long' });
  const month = `${name.charAt(0).toLocaleUpperCase(props.locale)}${name.slice(1)}`;
  const sentences: string[] = [];

  if (days !== undefined) {
    const hardest = days.side === 'hardest';
    const all = days.matching === days.total;

    sentences.push(
      t(
        all
          ? countedKey(hardest ? 'stats.patternHardestAll' : 'stats.patternBestAll', days.total, props.locale)
          : hardest
            ? 'stats.patternHardestSome'
            : 'stats.patternBestSome',
        { month, n: days.total, k: days.matching, tag: days.tag },
      ),
    );
  }

  if (companion !== undefined) {
    sentences.push(
      t(companion.tag === days?.tag ? 'stats.patternCompanionSame' : 'stats.patternCompanion', {
        tag: companion.tag,
        emotion: emotionLabel(companion.emotionId, t),
        k: companion.matching,
        n: companion.total,
      }),
    );
  }

  const focus: JournalFocus | null =
    days !== undefined
      ? {
          label: t(days.side === 'hardest' ? 'feed.focusHardest' : 'feed.focusBest', { tag: days.tag }),
          entryIds: days.entryIds,
        }
      : companion !== undefined
        ? {
            label: t('feed.focusCompanion', {
              tag: companion.tag,
              emotion: emotionLabel(companion.emotionId, t),
            }),
            entryIds: companion.entryIds,
          }
        : null;

  return (
    <View style={{ gap: 12 }}>
      {/* A paragraph each: the two can be about different topics, and run together they read as one claim. */}
      {sentences.map((sentence) => (
        <AppText key={sentence} variant="body">
          {sentence}
        </AppText>
      ))}
      {focus === null ? null : (
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => {
            props.onOpenEntries(focus);
          }}
        >
          <AppText variant="body" color="accentInk">
            {`${t(days !== undefined ? 'stats.patternOpenDays' : 'stats.patternOpenEntries')} ›`}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

/**
 * What the shapes under the frosted glass take from the paid card: a ring of
 * three slices and their rows. Made up, so no topic, count or share of the
 * person's week is behind the blur — it only says that something is there.
 */
const LOCKED_SHARES = [0.45, 0.33, 0.22] as const;
const LOCKED_ROWS = ['72%', '56%', '40%'] as const;
const LOCKED_RING = 88;

/** Where the locked pattern's two sentences would be: three lines and a short one. */
const LOCKED_LINES = ['94%', '86%', '90%', '46%'] as const;

/**
 * What stands over a paid part of the week for someone without a
 * subscription (owner's word, 2026-10-23): frosted glass over the shape of
 * the thing, a veil of the card's own paper so the words read against
 * something quiet, and a lock with the way in. The parent clips it and
 * takes the tap.
 */
function LockOverlay(props: { readonly label: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <>
      <BlurView
        intensity={theme.isDark ? 34 : 30}
        tint={theme.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.palette.paper, opacity: 0.3 }]}
      />
      <View
        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 44,
            backgroundColor: theme.palette.solid,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="lock" size={ICON_SIZE.inline} color="onSolid" />
        </View>
        <AppText variant="body" color="accentInk">
          {props.label} ›
        </AppText>
      </View>
    </>
  );
}

/**
 * What the topics section looks like unpaid: the paid card's shape under
 * frosted glass, with a lock and the way in over it, so the section says
 * plainly that a subscription opens it (owner's word, 2026-10-23).
 */
function TopicsLocked(props: {
  readonly t: Translate;
  readonly onOpenSubscription: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const circumference = 2 * Math.PI * RING.radius;
  let travelled = 0;

  return (
    <View style={{ marginBottom: 28 }}>
      <AppText variant="caption" color="inkFaint" style={{ marginBottom: 14 }}>
        {props.t('stats.topicsTitle')}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.t('stats.readAll')}
        onPress={props.onOpenSubscription}
        style={{
          borderWidth: 1,
          borderColor: theme.palette.line,
          backgroundColor: theme.palette.paper,
          borderRadius: 22,
          overflow: 'hidden',
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 22, padding: 22 }}
        >
          <Svg width={LOCKED_RING} height={LOCKED_RING} viewBox="0 0 100 100">
            {LOCKED_SHARES.map((share, at) => {
              const length = share * circumference;
              const offset = -travelled;

              travelled += length;

              return (
                <Circle
                  key={share}
                  cx={50}
                  cy={50}
                  r={RING.radius}
                  fill="none"
                  stroke={themeColour(theme.palette, at)}
                  strokeWidth={RING.width}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 50 50)"
                />
              );
            })}
          </Svg>
          <View style={{ flex: 1, gap: 14 }}>
            {LOCKED_ROWS.map((width, at) => (
              <View key={width} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: themeColour(theme.palette, at),
                  }}
                />
                <View
                  style={{ height: 11, width, borderRadius: 6, backgroundColor: theme.palette.skeleton }}
                />
              </View>
            ))}
          </View>
        </View>
        <LockOverlay label={props.t('stats.readAll')} />
      </Pressable>
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
