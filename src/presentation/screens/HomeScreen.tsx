import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import type { HomeView } from '@/application/use-cases/GetHomeView';
import { entriesOpen } from '@/domain/entities/Entitlement';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { Milestone } from '@/domain/entities/Milestone';
import type { ParkedTake } from '@/domain/ports/IParkedTake';
import { type Locale, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { TapTarget } from '../components/Button';
import { Icon, ICON_SIZE } from '../components/Icon';
import { AffirmationButton } from '../components/AffirmationButton';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { LockedLine } from '../components/LockGlass';
import type { BloomOrigin, Charm } from '../components/AffirmationCharm';
import { RecordButton } from '../components/RecordButton';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';

import { WeekStrip } from '../components/WeekStrip';
import { UpdateLine } from '../components/UpdateLine';
import { YearEchoCard } from '../components/YearEchoCard';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, emotionWordsIn, moodTint } from '../components/emotionDisplay';

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
  /**
   * Whether every entry reads, with a subscription or its free trial. Without
   * one (owner's word, 2026-11-17) the month-ago card stands with a lock and
   * a faint line where the words were, and opens the subscription; the
   * year-ago card is not shown. Null until the store has answered, while
   * both cards wait rather than show and then lock.
   */
  readonly readsAll: boolean | null;
  readonly onOpenSubscription: () => void;
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
  /** Opens the App Store page of a newer version; null while this one is the newest. */
  readonly onUpdate: (() => void) | null;
  /** The update line's X: that version's line stays closed. */
  readonly onCloseUpdate: () => void;
  /**
   * The affirmation button: the picked one's look, null while this period's
   * waits to be picked, or absent while affirmations are off.
   */
  readonly affirmation: { readonly picked: Charm | null } | null;
  /** A waiting one opens the five; a picked one grows out of the button. */
  readonly onAffirmation: (origin: BloomOrigin) => void;
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
  const week = props.home?.week ?? [];
  // The newest entry, which always reads, whatever the plan.
  const recent = props.home?.recentEntries ?? [];
  const open = entriesOpen(recent, props.readsAll === true);
  const reads = (entry: MoodEntry): boolean => open === null || open.has(entry.id);
  const yearEcho = props.readsAll === null || props.home?.yearEcho == null ? null : props.home.yearEcho;
  const shownYearEcho = yearEcho !== null && reads(yearEcho.entry) ? yearEcho : null;
  const echo = props.readsAll === null || props.home?.echo == null ? null : props.home.echo;
  const echoLocked = echo !== null && !reads(echo);
  const offersYesterday = props.home?.offersYesterday ?? false;

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
      {props.onUpdate === null ? null : (
        <UpdateLine t={props.t} onUpdate={props.onUpdate} onClose={props.onCloseUpdate} />
      )}
      {/*
        * The date at the top left, back by the owner's word (2026-11-16), and
        * the affirmation opposite it (owner's word, 2026-11-16, moved here
        * from the journal): the waiting mark until this period's is picked,
        * then the picked one's face, which grows to the whole screen again.
        */}
      <View
        style={{
          flexDirection: 'row',
          // Wraps rather than clips: at large type the button drops under the date.
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          minHeight: 44,
        }}
      >
        <AppText variant="caption" color="inkFaint">
          {formatToday(props.locale)}
        </AppText>
        {props.affirmation === null ? null : (
          <AffirmationButton
            picked={props.affirmation.picked}
            label={props.t(props.affirmation.picked === null ? 'affirmation.pick' : 'feed.affirmation')}
            onPress={props.onAffirmation}
          />
        )}
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
          /*
           * Pulled up into the record button's halo (owner's word,
           * 2026-11-16): it belongs to the button, not to the links below.
           * The rings stay clear of it; they reach 176 of the 196 points.
           */
          <AppText variant="body" color="inkSoft" style={{ marginTop: -16 }}>
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
      {shownYearEcho === null ? null : (
        <YearEchoCard
          echo={shownYearEcho}
          vocabulary={props.vocabulary}
          locale={props.locale}
          t={props.t}
          onOpen={props.onOpen}
        />
      )}

      {/* Back under the record button, where it was (owner's word, 2026-11-16). */}
      {echo === null ? null : (
        <EchoFromPast
          entry={echo}
          vocabulary={props.vocabulary}
          t={props.t}
          alsoYear={shownYearEcho !== null}
          onOpen={echoLocked ? props.onOpenSubscription : props.onOpen}
          locked={echoLocked}
        />
      )}

      {/*
        * The last entry (owner's word, 2026-11-17; two from 2026-11-16,
        * three until 2026-11-14), as a list and nothing more: no heading, no "all" link —
        * the journal tab is where entries live — and nothing at all while
        * there are none.
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
 *
 * Set apart from the entries under it (owner's word, 2026-10-15): bordered
 * and unfilled, it read as one more of them. Now it sits on the accent's soft
 * tint with no border, its caption in the accent and the old words quoted —
 * Vidlun bringing something back, which is what the accent means.
 */
function EchoFromPast(props: {
  readonly entry: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
  /** True when the year-ago card sits above; the label then reads as "and". */
  readonly alsoYear: boolean;
  readonly onOpen: (entry: MoodEntry) => void;
  /**
   * Under the subscription's lock (owner's word, 2026-11-17): a small lock
   * where the emotion was and one faint line where the words were.
   */
  readonly locked: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const first = props.entry.emotionIds[0];
  // The mood marks the entry; the emotion's name wears the one blue.
  const colour = moodTint(props.entry.mood?.value ?? null, theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        props.locked
          ? `${props.t(props.alsoYear ? 'home.echoAlsoPast' : 'home.echoPast')}. ${props.t('subs.entryLocked')}`
          : undefined
      }
      onPress={() => {
        props.onOpen(props.entry);
      }}
      style={{
        borderRadius: 22,
        backgroundColor: theme.palette.accentSoft,
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
        <AppText variant="caption" color="accentInk">
          {props.t(props.alsoYear ? 'home.echoAlsoPast' : 'home.echoPast')}
        </AppText>
        {props.locked ? (
          <View style={{ marginLeft: 'auto' }}>
            <Icon name="lock" size={14} color="accentInk" />
          </View>
        ) : first === undefined ? null : (
          <AppText
            variant="secondary"
            numberOfLines={1}
            style={{ fontSize: 13, color: theme.palette.tag, marginLeft: 'auto', flexShrink: 1 }}
          >
            {emotionLabel(first, emotionWordsIn(props.entry.cleanTranscript, props.t))}
          </AppText>
        )}
      </View>
      {props.locked ? (
        <LockedLine entryId={props.entry.id} onAccent />
      ) : (
        <AppText variant="body" numberOfLines={2} style={{ fontSize: 16, lineHeight: 23 }}>
          {props.t('common.quoted', { text: props.entry.cleanTranscript })}
        </AppText>
      )}
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
