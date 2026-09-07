import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import type { DailyMood } from '@/application/use-cases/GetWeekSummary';
import type { HomeView } from '@/application/use-cases/GetHomeView';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { Milestone } from '@/domain/entities/Milestone';
import type { ParkedTake } from '@/domain/ports/IParkedTake';
import { emotionKey, type Locale, type Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { Icon, ICON_SIZE } from '../components/Icon';
import { RecordButton } from '../components/RecordButton';
import { CheckShape } from '../components/Shapes';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';

import { WeekStrip } from '../components/WeekStrip';
import { YearEchoCard } from '../components/YearEchoCard';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

export interface HomeScreenProps {
  readonly home: HomeView | null;
  /** Opens the text screen aimed at yesterday. Shown only over a hole. */
  readonly onSayYesterday: () => void;
  /** The month for the first-days card, or null off-season. */
  readonly monthCard: Date | null;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly today: Date;
  readonly onDelete: (id: string) => void;
  readonly onOpenHistory: () => void;
  readonly onOpenStats: () => void;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly t: Translate;
  readonly onRecord: () => void;
  readonly onWrite: () => void;
  /** Whether the phone can hear yet: the speech model's state. */
  readonly voice: SpeechModelState;
  /** Starts the model download, or tries it again after a failure. */
  readonly onFetchVoice: () => void;
  /** A take recorded before the phone could hear, waiting to be read. */
  readonly parked: ParkedTake | null;
  readonly onContinueParked: () => void;
  /** Opens the waiting screen: where the download stands, or the offer to start it. */
  readonly onShowParked: () => void;
  /** Where the microphone stands with the system; `denied` is named, not retried. */
  readonly mic: PermissionStatus;
  /** Every milestone; the strip marks the days in its week. */
  readonly milestones: readonly Milestone[];
}

export function HomeScreen(props: HomeScreenProps): React.JSX.Element {
  const theme = useTheme();
  const canHear = props.voice.kind === 'ready';
  /*
   * A refused microphone is the one state the app cannot change from inside:
   * the tap is left to the flow, which asks when it may, and the line below
   * points at Settings when it may not.
   */
  const micRefused = props.mic === 'denied';
  /** True after a tap on the microphone that could not record yet. */
  const [nudged, setNudged] = useState(false);
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
        {streak > 0 ? (
          <StreakPill days={streak} label={props.t(countedKey('home.streak', streak, props.locale))} />
        ) : null}
      </View>

      {week.length > 0 ? (
        /*
         * The strip is the week in miniature, so the way into the week itself
         * belongs on it rather than in a tab. Tapping the days is the same
         * gesture as reading them, one step further.
         */
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.t('home.seeWeek')}
          onPress={props.onOpenStats}
          style={{ gap: 10 }}
        >
          <WeekStrip
            week={week}
            vocabulary={props.vocabulary}
            locale={props.locale}
            noEntryLabel={props.t('home.noEntryThatDay')}
            milestones={props.milestones}
          />
          {/*
            Named rather than left to be discovered: a strip that silently
            opens something is a control nobody knows is there.
          */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: yesterdayEmpty(week) ? 'space-between' : 'flex-end',
              alignItems: 'baseline',
            }}
          >
            {yesterdayEmpty(week) ? (
              /*
               * The hole in the strip, made closable. Quiet on purpose: the
               * strip's own philosophy says a missed day is not a failure,
               * so the way to fill it is an offer, never a nag.
               */
              <Pressable
                accessibilityRole="button"
                onPress={props.onSayYesterday}
                hitSlop={10}
              >
                <AppText variant="secondary" color="inkFaint">
                  {props.t('home.sayYesterday')}
                </AppText>
              </Pressable>
            ) : null}
            <AppText variant="secondary" color="inkFaint">
              {`${props.t('home.weekLink')} ›`}
            </AppText>
          </View>
        </Pressable>
      ) : null}

      <AppText variant="display" style={{ marginTop: 22 }}>
        {props.t('home.prompt')}
      </AppText>

      <View style={{ alignItems: 'center', gap: 18, paddingTop: 16, paddingBottom: 34 }}>
        {/*
          * Recording does not wait for the model. Said before the phone can
          * hear, a take is kept and read when it can — the line below says
          * so while the download runs. Only a refused microphone stops the
          * tap, and then the tap only turns that line to ink: the fix is in
          * Settings, not here.
          */}
        <View style={{ opacity: micRefused ? 0.55 : 1 }}>
          <RecordButton
            onPress={
              micRefused
                ? () => {
                    setNudged(true);
                  }
                : props.onRecord
            }
            accessibilityLabel={props.t('home.recordHint')}
          />
        </View>
        {micRefused ? (
          <View style={{ alignItems: 'center', gap: 9, width: 258 }}>
            <AppText
              variant="secondary"
              color={nudged ? 'ink' : 'inkSoft'}
              align="center"
              style={{ lineHeight: 21 }}
            >
              {props.t('home.micDenied')}
            </AppText>
            <QuietLink
              label={props.t('home.micSettings')}
              onPress={() => {
                void Linking.openSettings();
              }}
            />
          </View>
        ) : (
          <VoiceLine voice={props.voice} nudged={nudged} t={props.t} onFetch={props.onFetchVoice} />
        )}
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
        {/*
          * Offered, not sprung: the take said before the phone could hear is
          * read when the person asks, not the moment the model lands under
          * whatever they were doing.
          */}
        {props.parked !== null && canHear ? (
          <Pressable
            accessibilityRole="button"
            onPress={props.onContinueParked}
            hitSlop={12}
            style={{ paddingVertical: 6 }}
          >
            <AppText variant="label" color="accentInk">
              {`${props.t('home.parkedReady')} ›`}
            </AppText>
          </Pressable>
        ) : null}
        {/*
          * Until the model lands the take has to be seen to be waiting: a
          * recording that vanished into a download is one the person will
          * assume is lost. The card leads to the waiting screen, which says
          * where the download stands or offers to start it.
          */}
        {props.parked !== null && !canHear ? (
          <ParkedWaitingCard
            take={props.parked}
            voice={props.voice}
            locale={props.locale}
            today={props.today}
            t={props.t}
            onPress={props.onShowParked}
          />
        ) : null}
      </View>

      {props.monthCard === null ? null : (
        <MonthReadyCard month={props.monthCard} locale={props.locale} t={props.t} onOpen={props.onOpenStats} />
      )}

      {props.home?.yearEcho == null ? null : (
        <YearEchoCard
          echo={props.home.yearEcho}
          vocabulary={props.vocabulary}
          locale={props.locale}
          t={props.t}
          onOpen={props.onOpen}
        />
      )}

      {props.home?.echo == null ? null : (
        <EchoFromPast
          entry={props.home.echo}
          vocabulary={props.vocabulary}
          t={props.t}
          alsoYear={props.home.yearEcho !== null}
          onOpen={props.onOpen}
        />
      )}

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
                  vocabulary={props.vocabulary}
                  locale={props.locale}
                  today={props.today}
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

/**
 * The drawing's echo card: three dots fading like a sound dying away, the
 * marker, the old entry's own words. Most days it is simply not there —
 * which is what makes the day it appears feel like being remembered.
 */
function EchoFromPast(props: {
  readonly entry: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
  /** True when the year-ago card sits above; the label then reads as "and". */
  readonly alsoYear: boolean;
  readonly onOpen: (entry: MoodEntry) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const first = props.entry.emotionIds[0];
  const emotion = first === undefined ? undefined : props.vocabulary.find(first);
  const colour =
    emotion === undefined
      ? theme.palette.line
      : colorForEmotion(props.vocabulary, emotion, theme.isDark ? 'dark' : 'light');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        props.onOpen(props.entry);
      }}
      style={{
        borderWidth: 1,
        borderColor: theme.palette.line,
        borderRadius: 22,
        paddingVertical: 18,
        paddingHorizontal: 20,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: colour }} />
          <View
            style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: colour, opacity: 0.55 }}
          />
          <View
            style={{ width: 3, height: 3, borderRadius: 3, backgroundColor: colour, opacity: 0.3 }}
          />
        </View>
        <AppText variant="caption" color="inkFaint">
          {props.t(props.alsoYear ? 'home.echoAlsoPast' : 'home.echoPast')}
        </AppText>
        {first === undefined ? null : (
          <AppText
            variant="secondary"
            numberOfLines={1}
            style={{ fontSize: 13, color: colour, marginLeft: 'auto', flexShrink: 1 }}
          >
            {props.t(emotionKey(first))}
          </AppText>
        )}
      </View>
      <AppText variant="body" numberOfLines={2} style={{ fontSize: 16, lineHeight: 23 }}>
        {props.entry.cleanTranscript}
      </AppText>
    </Pressable>
  );
}

/**
 * The drawing's first-days card: the previous month's piece is ready, and
 * home says so once — panel-dark, the month's own name, a lime way in.
 */
function MonthReadyCard(props: {
  readonly month: Date;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onOpen: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const monthName = props.month.toLocaleDateString(props.locale, { month: 'long' });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onOpen}
      style={{
        borderRadius: 22,
        backgroundColor: theme.palette.panel,
        paddingVertical: 20,
        paddingHorizontal: 22,
        marginBottom: 20,
        gap: 10,
      }}
    >
      <AppText variant="caption" style={{ color: theme.palette.onPanel, opacity: 0.6 }}>
        {props.t('stats.monthLabel')}
      </AppText>
      <AppText variant="kicker" style={{ color: theme.palette.onPanel, fontSize: 21 }}>
        {props.t('stats.monthTitle', { month: monthName })}
      </AppText>
      <AppText variant="secondary" style={{ color: theme.palette.lime }}>
        {`${props.t('home.monthCta')} ›`}
      </AppText>
    </Pressable>
  );
}

/**
 * The take said before the phone could hear, shown waiting under the
 * microphone: when it was said, and what it is waiting for.
 */
function ParkedWaitingCard(props: {
  readonly take: ParkedTake;
  readonly voice: SpeechModelState;
  readonly locale: Locale;
  readonly today: Date;
  readonly t: Translate;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const at = props.take.recordedAt;
  const time = at.toLocaleTimeString(props.locale, { hour: '2-digit', minute: '2-digit' });
  const sameDay = at.toDateString() === props.today.toDateString();
  const when = sameDay
    ? time
    : `${at.toLocaleDateString(props.locale, { day: 'numeric', month: 'short' })}, ${time}`;
  const moving = props.voice.kind === 'fetching';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={{
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginTop: 4,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.palette.line,
        backgroundColor: theme.palette.paper,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1.5,
          borderColor: theme.palette.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckShape color={theme.palette.accentInk} size={14} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body">{props.t('home.parkedWaitingAt', { time: when })}</AppText>
        <AppText variant="secondary" color="inkSoft" style={{ lineHeight: 19 }}>
          {props.t(moving ? 'home.parkedWaitingFetching' : 'home.parkedWaitingAbsent')}
        </AppText>
      </View>
      <AppText variant="body" color="inkFaint">
        ›
      </AppText>
    </Pressable>
  );
}

/** True when yesterday sits in the strip with nothing in it. */
function yesterdayEmpty(week: readonly DailyMood[]): boolean {
  return week.length >= 2 && week[week.length - 2]?.entryCount === 0;
}


/**
 * The line under the microphone. The hint while the phone can hear; while it
 * cannot, the download in the drawing's own words — with the percentage when
 * the server said how much there is — a retry once it has failed, and the
 * offer to start it where nothing has: the app never starts 668 MB by
 * itself, so someone who said "later" at onboarding finds the way here.
 */
function VoiceLine(props: {
  readonly voice: SpeechModelState;
  readonly nudged: boolean;
  readonly t: Translate;
  readonly onFetch: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const colour = props.nudged ? 'ink' : 'inkSoft';

  if (props.voice.kind === 'ready') {
    return (
      <AppText variant="body" color="inkSoft">
        {props.t('home.recordHint')}
      </AppText>
    );
  }

  if (props.voice.kind === 'absent' || props.voice.kind === 'failed') {
    const failed = props.voice.kind === 'failed';

    return (
      <View style={{ alignItems: 'center', gap: 8, width: 250 }}>
        <AppText variant="secondary" color={colour} align="center" style={{ lineHeight: 20 }}>
          {props.t(failed ? 'home.voiceFailed' : 'home.voiceAbsent')}
        </AppText>
        <QuietLink label={props.t(failed ? 'failure.retry' : 'home.voiceDownload')} onPress={props.onFetch} />
      </View>
    );
  }

  const percent =
    props.voice.kind === 'fetching' && props.voice.totalBytes !== null && props.voice.totalBytes > 0
      ? Math.min(99, Math.floor((props.voice.writtenBytes / props.voice.totalBytes) * 100))
      : null;

  /*
   * The drawing's download state: the line with its percentage, and under it
   * a hairline bar the accent fills. Two pixels tall on purpose — progress,
   * not a control.
   */
  return (
    <View style={{ alignItems: 'center', gap: 9, width: 232 }}>
      <AppText variant="secondary" color={colour} align="center" style={{ lineHeight: 20 }}>
        {percent === null
          ? props.t('home.voiceFetching')
          : `${props.t('home.voiceFetching')} · ${String(percent)}%`}
      </AppText>
      <View
        style={{
          width: 132,
          height: 2,
          borderRadius: 999,
          backgroundColor: theme.palette.line,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 2,
            width: `${percent ?? 0}%`,
            borderRadius: 999,
            backgroundColor: theme.palette.accent,
          }}
        />
      </View>
    </View>
  );
}

/** The drawing's underlined accent link, as the voice states set it. */
function QuietLink(props: { readonly label: string; readonly onPress: () => void }): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} hitSlop={12}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: theme.palette.accentInk, paddingBottom: 1 }}>
        <AppText variant="secondary" color="accentInk">
          {props.label}
        </AppText>
      </View>
    </Pressable>
  );
}
