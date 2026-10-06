import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import type { HomeView } from '@/application/use-cases/GetHomeView';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { Milestone } from '@/domain/entities/Milestone';
import type { ParkedTake } from '@/domain/ports/IParkedTake';
import { type Locale, type Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { TapTarget } from '../components/Button';
import { CountPill } from '../components/CountPill';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { Icon, ICON_SIZE } from '../components/Icon';
import { RecordButton } from '../components/RecordButton';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';

import { WeekStrip } from '../components/WeekStrip';
import { YearEchoCard } from '../components/YearEchoCard';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, moodTint } from '../components/emotionDisplay';

export interface HomeScreenProps {
  readonly home: HomeView | null;
  /** Opens the text screen aimed at yesterday. Shown only over a hole. */
  readonly onSayYesterday: () => void;
  /** The month for the first-days card, or null off-season. */
  readonly monthCard: Date | null;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly today: Date;
  readonly onOpenStats: () => void;
  /** The month card: the month written back, or the plans without access to it. */
  readonly onOpenMonth: () => void;
  /** The month card's X: that month's card stays closed. */
  readonly onCloseMonth: () => void;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly onDelete: (id: string) => void;
  readonly t: Translate;
  readonly onRecord: () => void;
  readonly onWrite: () => void;
  /** A take recorded before the phone could hear, waiting to be read. */
  readonly parked: ParkedTake | null;
  readonly onContinueParked: () => void;
  /** Where the microphone stands with the system; `denied` is named, not retried. */
  readonly mic: PermissionStatus;
  /** Every milestone; the strip marks the days in its week. */
  readonly milestones: readonly Milestone[];
}

export function HomeScreen(props: HomeScreenProps): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  /*
   * A refused microphone is the one state the app cannot change from inside:
   * the tap is left to the flow, which asks when it may, and the line below
   * points at Settings when it may not.
   */
  const micRefused = props.mic === 'denied';
  /** True after a tap on the microphone that could not record yet. */
  const [nudged, setNudged] = useState(false);
  const streak = props.home?.streakDays ?? 0;
  const week = props.home?.week ?? [];
  const offersYesterday = props.home?.offersYesterday ?? false;
  const recent = props.home?.recentEntries ?? [];

  /*
   * Home scrolls. It used to be a fixed column with the record button in a
   * flex:1 middle, which held only while the blocks under it were short —
   * the moment they filled, the middle was squeezed and the button climbed
   * over the question. Nothing here competes for height any more: every
   * block is its own size and the page moves under them.
   */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: 118 }}
    >
      <View
        style={{
          flexDirection: 'row',
          // Wraps rather than clips: at large type the pill drops under the date.
          flexWrap: 'wrap',
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
          <CountPill value={streak} label={props.t(countedKey('home.streak', streak, props.locale))} />
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
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: offersYesterday ? 'space-between' : 'flex-end',
              alignItems: 'baseline',
            }}
          >
            {offersYesterday ? (
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
                <AppText variant="secondary" color="inkFaint" maxScale={1.3}>
                  {props.t('home.sayYesterday')}
                </AppText>
              </Pressable>
            ) : null}
            {/* Two links share this row; past 1.3 they run into each other. */}
            <AppText variant="secondary" color="inkFaint" maxScale={1.3}>
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
          <AppText variant="body" color="inkSoft">
            {props.t('home.recordHint')}
          </AppText>
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
          * A take parked by an earlier version, before the model came with
          * the app: offered, not sprung — read when the person asks, not the
          * moment they open the app over whatever they were doing.
          */}
        {props.parked !== null ? (
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
      </View>

      {props.monthCard === null ? null : (
        <MonthReadyCard
          month={props.monthCard}
          locale={props.locale}
          t={props.t}
          onOpen={props.onOpenMonth}
          onClose={props.onCloseMonth}
        />
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


      {/*
        * The last three entries, as a list and nothing more: no heading, no
        * "all" link — the journal tab is where entries live — and nothing at
        * all while there are none. Owner's call on the first day on sale.
        */}
      {recent.length === 0 ? null : (
        <SwipeGroup>
          <View style={{ gap: 12, marginTop: 6 }}>
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
    </ScrollView>
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
  // The mood marks the entry; the emotion's name wears the one blue.
  const colour = moodTint(props.entry.mood?.value ?? null, theme);

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
            style={{ fontSize: 13, color: theme.palette.tag, marginLeft: 'auto', flexShrink: 1 }}
          >
            {emotionLabel(first, props.t)}
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
  readonly onClose: () => void;
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
      {/*
        * An X to put the card away before its week is up (owner's word,
        * 2026-10-06), pulled into the corner by its own margin so the row
        * keeps its height and the finger still gets 44 points.
        */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="caption" style={{ color: theme.palette.onPanel, opacity: 0.6 }}>
          {props.t('home.monthKicker', { month: monthName })}
        </AppText>
        <View style={{ marginRight: -12, marginVertical: -12, opacity: 0.6 }}>
          <TapTarget onPress={props.onClose} accessibilityLabel={props.t('common.close')}>
            <Icon name="x" size={ICON_SIZE.inline} color="onPanel" />
          </TapTarget>
        </View>
      </View>
      <AppText variant="kicker" style={{ color: theme.palette.onPanel, fontSize: 21 }}>
        {props.t('home.monthLead')}
      </AppText>
      <AppText variant="secondary" style={{ color: theme.palette.lime }}>
        {`${props.t('home.monthCta')} ›`}
      </AppText>
    </Pressable>
  );
}



/** The drawing's underlined accent link. */
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
