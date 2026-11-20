import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { affirmationFrequencyFor, readsInFull, type Entitlement } from '@/domain/entities/Entitlement';
import type { AffirmationFrequency } from '@/domain/ports/IAffirmationReminders';
import type { LockMethod } from '@/domain/ports/IScreenLock';
import type { Settings, ThemeChoice } from '@/domain/ports/ISettings';
import type { Locale, Translate, TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { ModalSheet, SheetClose } from '../components/ModalSheet';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { backupWhen } from './backupWhen';

/** The bar floats over this screen, so the last row needs room under it. */
const BOTTOM_ROOM = 118;

/** The drawing's order: what you choose, then what chooses for you. */
const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

const THEME_LABELS: Readonly<Record<ThemeChoice, TranslationKey>> = {
  light: 'profile.themeLight',
  dark: 'profile.themeDark',
  system: 'profile.themeSystem',
};

/** One value per row, and three rows visible: the chosen one and its neighbours. */
const FREQUENCIES: readonly AffirmationFrequency[] = ['daily', 'weekly', 'monthly'];

const FREQUENCY_LABELS: Readonly<Record<AffirmationFrequency, TranslationKey>> = {
  daily: 'profile.affirmationsDaily',
  weekly: 'profile.affirmationsWeekly',
  monthly: 'profile.affirmationsMonthly',
};

/** When it comes, under the name once it is on: the frequency picked says only how often. */
const FREQUENCY_HINTS: Readonly<Record<AffirmationFrequency, TranslationKey>> = {
  daily: 'profile.affirmationsHintDaily',
  weekly: 'profile.affirmationsHintWeekly',
  monthly: 'profile.affirmationsHintMonthly',
};

/** The lock is called what opens the phone: Face ID, Touch ID or the passcode. */
const LOCK_NAMES: Readonly<Record<LockMethod, TranslationKey>> = {
  face: 'lock.nameFace',
  touch: 'lock.nameTouch',
  passcode: 'lock.namePasscode',
};

const LOCK_ON_HINTS: Readonly<Record<LockMethod, TranslationKey>> = {
  face: 'profile.lockOnFace',
  touch: 'profile.lockOnTouch',
  passcode: 'profile.lockOnPasscode',
};

const ROW_HEIGHT = 46;
const WHEEL_HEIGHT = ROW_HEIGHT * 3;

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);
/** Five-minute steps: nobody sets a journal reminder for 21:37. */
const MINUTES = Array.from({ length: 12 }, (_unused, at) => at * 5);

/**
 * The person's own corner: the handful of things they get to decide.
 *
 * No numbers at the top any more (owner's word, 2026-10-01): the entries are
 * counted in the journal and the days on home, each where it is read.
 */
export function ProfileScreen(props: {
  readonly settings: Settings;
  readonly t: Translate;
  readonly onChange: (settings: Settings) => void;
  readonly entitlement: Entitlement;
  /** False while nothing is sold: the subscription section is not shown at all. */
  readonly selling: boolean;
  readonly onOpenSubscription: () => void;
  /** Apple's sheet for an offer code: six months free (owner's word, 2026-11-19). */
  readonly onRedeemCode: () => void;
  /** Hands one export file to the share sheet; null label means nothing yet. */
  readonly onExport: (shape: 'backup' | 'markdown') => void;
  /** How far a backup in progress is; null while none runs. */
  readonly backupProgress: BackupProgress | null;
  /** How far a readable export in progress is; null while none runs. */
  readonly exportProgress: BackupProgress | null;
  /** When a backup was last handed over; null before the first. */
  readonly lastBackup: Date | null;
  /** The clock's today, for saying "today" and "yesterday". */
  readonly today: Date;
  readonly onRestore: () => void;
  /** Mails a note to support; rejects when it could not be delivered. */
  /** Opens the note-to-support sheet, which lives above the tabs rather than in here. */
  readonly onWriteFeedback: () => void;
  /** Opens the grounding exercise. */
  readonly onGround: () => void;
  /** What opens this phone, which names the lock row. */
  readonly lockMethod: LockMethod;
  /** Asks for Face ID once; resolves false when it failed or the phone has no lock to use. */
  readonly onEnableLock: () => Promise<boolean>;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const { settings, t } = props;
  const [pickingTime, setPickingTime] = useState(false);
  /*
   * The lock switch while Face ID is being asked. The native switch flips
   * itself on at the tap; if the ask fails the setting stays false, and a
   * prop that stays false is no change for React to push back to the native
   * side — the switch would sit on, lying. Holding "true" for the duration
   * and dropping it after gives the native switch a real true→false.
   */
  const [armingLock, setArmingLock] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: BOTTOM_ROOM }}
    >
      <AppText variant="display" style={{ marginBottom: 22 }}>
        {t('profile.title')}
      </AppText>

      {/*
        * The way back into the grounding exercise at any time (owner's word,
        * 2026-10-06): its last page promises one, and after a hard entry was
        * the only door. First, because it is the one thing here that is not
        * a setting.
        */}
      <Section>
        <Row title={t('profile.grounding')} hint={t('profile.groundingHint')} onPress={props.onGround}>
          <Pill label={t('profile.groundingAction')} />
        </Row>
      </Section>

      <Section>
        {/*
          Off, the row says so where the time would be (owner's word,
          2026-10-20); on, the time stands there and "every day" under the name.
        */}
        <Row
          title={t('profile.reminder')}
          hint={settings.reminderOn ? t('profile.everyDay') : undefined}
          onPress={() => {
            setPickingTime(true);
          }}
        >
          {settings.reminderOn ? (
            <AppText variant="numeric" style={{ fontSize: 17 }}>
              {clockOf(settings)}
            </AppText>
          ) : (
            <AppText variant="body" color="inkSoft">
              {t('profile.reminderOff')}
            </AppText>
          )}
          <AppText variant="body" color="inkFaint">
            ›
          </AppText>
        </Row>
      </Section>

      <Affirmations
        settings={settings}
        t={t}
        onChange={props.onChange}
        readsAll={readsInFull(props.entitlement)}
        onOpenSubscription={props.onOpenSubscription}
      />

      <Theme settings={settings} t={t} onChange={props.onChange} />

      <Section>
        <Row
          title={t('profile.keepAudio')}
          hint={t(settings.keepRecordings ? 'profile.audioOn' : 'profile.audioOff')}
        >
          <Switch
            value={settings.keepRecordings}
            onValueChange={(keep) => {
              if (keep) {
                props.onChange({ ...settings, keepRecordings: true });

                return;
              }

              /*
               * Turning this off means the voice goes, not merely that no more
               * is kept. Leaving a year of audio behind a switch that says no
               * would be the opposite of what was asked for — so it is said
               * out loud rather than done quietly.
               */
              Alert.alert(t('settings.forgetTitle'), t('settings.forgetBody'), [
                { text: t('settings.forgetCancel'), style: 'cancel' },
                {
                  text: t('settings.forgetConfirm'),
                  style: 'destructive',
                  onPress: () => {
                    props.onChange({ ...settings, keepRecordings: false });
                  },
                },
              ]);
            }}
            trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
            accessibilityLabel={t('profile.keepAudio')}
          />
        </Row>
      </Section>

      {/*
        * The journal's lock, back and free (owner's word, 2026-11-20): where
        * it stood before 1.4, between keeping the voice and the backup.
        */}
      <Section>
        <Row
          title={t(LOCK_NAMES[props.lockMethod])}
          hint={t(settings.journalLock ? LOCK_ON_HINTS[props.lockMethod] : 'profile.lockOff')}
        >
          <Switch
            value={settings.journalLock || armingLock}
            onValueChange={(lock) => {
              if (!lock) {
                props.onChange({ ...settings, journalLock: false });

                return;
              }

              /*
               * Proven before promised: the switch turns on only after one
               * successful unlock, so nobody shuts themselves out behind a
               * Face ID that does not work.
               */
              setArmingLock(true);
              void props.onEnableLock().then(
                (unlocked) => {
                  setArmingLock(false);

                  if (unlocked) {
                    props.onChange({ ...settings, journalLock: true });
                  }
                },
                () => {
                  setArmingLock(false);
                },
              );
            }}
            trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
            accessibilityLabel={t(LOCK_NAMES[props.lockMethod])}
          />
        </Row>
      </Section>

      {/*
        The paywall's free-forever list promises backup; this is where the
        promise is kept. Two shapes on purpose: the JSON file is the copy
        that comes back, the markdown one is for reading somewhere else.
        No drawing exists for this section yet — it wears Row like the rest.
      */}
      {/*
        The drawing's backup card shows a copy in iCloud with a "manage"
        pill. There is no iCloud copy: the backup is a file the person keeps
        where they choose, and a row claiming otherwise would be the one lie
        the settings screen must not tell. The card wears the drawing's
        shape — rows with pill actions — around what actually exists.
      */}
      {/*
        Under the card, one quiet line on the phone's own iCloud backup
        (owner's word, 2026-11-19): it carries the journal and the voice too,
        as the privacy policy's §4 says, and someone counting their copies
        should know it is there.
      */}
      <Section footer={t('profile.backupICloud')}>
        <Row
          title={t('profile.backup')}
          hint={backupHint(props.backupProgress, props.lastBackup, props.today, settings.locale, t)}
          onPress={() => {
            props.onExport('backup');
          }}
        >
          <Pill label={t('profile.backupAction')} />
        </Row>
        {/*
          The readable export (owner's word, 2026-11-19, drawn in the canvas's
          export page): between the backup and the way back, built like the
          backup's row. Free, and every entry in it, a closed one too.
        */}
        <Row
          title={t('profile.exportMd')}
          hint={exportHint(props.exportProgress, t)}
          onPress={() => {
            props.onExport('markdown');
          }}
        >
          <Pill label={t('profile.exportAction')} />
        </Row>
        <Row title={t('profile.restore')} hint={t('profile.restoreHint')} onPress={props.onRestore}>
          <Pill label={t('profile.restoreAction')} />
        </Row>
      </Section>


      <Section>
        <Row
          title={t('profile.feedbackTitle')}
          hint={t('profile.feedbackHint')}
          onPress={props.onWriteFeedback}
        >
          <Pill label={t('profile.feedbackAction')} />
        </Row>
      </Section>

      {/*
        "Language" over the choice, in a card like the theme's (owner's word,
        2026-10-20): the pills used to stand on their own with no name, and
        the two pickers now read as the same kind of thing.
      */}
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.palette.line,
          backgroundColor: theme.palette.paper,
          borderRadius: 22,
          padding: 16,
          marginBottom: 26,
        }}
      >
        <AppText variant="body" style={{ fontSize: 16, marginLeft: 4, marginTop: 1, marginBottom: 13 }}>
          {t('profile.languageTitle')}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            padding: 4,
            borderRadius: 999,
            backgroundColor: theme.palette.lineSoft,
          }}
        >
          {/* The drawing's order, which is not the locale list's: uk first. */}
          {(['uk', 'en'] as const).map((locale) => {
            const chosen = settings.locale === locale;

            return (
              <Pressable
                key={locale}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                onPress={() => {
                  props.onChange({ ...settings, locale });
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 999,
                  backgroundColor: chosen ? theme.palette.paper : 'transparent',
                }}
              >
                <AppText variant="body" color={chosen ? 'ink' : 'inkSoft'}>
                  {t(`language.${locale}` as TranslationKey)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/*
        * Last, under everything the person sets (owner's word, 2026-10-01),
        * with its name alone and the way in as a button of its own. The verb
        * is the paywall's own for taking a plan: not buy, since the tap only
        * opens the plans, and not activate, which promises something already
        * there to switch on. Once there is a plan, the same button manages it.
        * Hidden while nothing is sold (owner's word, 2026-11-02).
        */}
      {props.selling ? (
        <Section>
          <View style={{ paddingVertical: 17, gap: 14 }}>
            <Heading title={t('subs.name')} hint={t(subscriptionHint(props.entitlement))} />
            <Button
              label={t(props.entitlement === 'none' ? 'profile.subscribe' : 'profile.manage')}
              variant="secondary"
              onPress={props.onOpenSubscription}
            />
            {/* A promo code, for someone without a plan (owner's word, 2026-11-19). */}
            {props.entitlement === 'none' ? (
              <Button label={t('subs.redeemCode')} variant="link" onPress={props.onRedeemCode} />
            ) : null}
          </View>
        </Section>
      ) : null}

      <TimeSheet
        open={pickingTime}
        settings={settings}
        t={t}
        onDone={(next) => {
          setPickingTime(false);
          props.onChange(next);
        }}
        onClose={() => {
          setPickingTime(false);
        }}
      />
    </ScrollView>
  );
}

/**
 * Three states, not two. §7.6 argues that a preference the time of day can
 * override is not a preference, and the drawing now agrees: light and dark are
 * always themselves, and system follows the phone and says which way it is
 * leaning right now.
 */
function Theme(props: {
  readonly settings: Settings;
  readonly t: Translate;
  readonly onChange: (settings: Settings) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { settings, t } = props;

  const hint = t(
    settings.theme === 'system'
      ? 'profile.themeHintSystem'
      : settings.theme === 'dark'
        ? 'profile.themeHintDark'
        : 'profile.themeHintLight',
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.palette.line,
        backgroundColor: theme.palette.paper,
        borderRadius: 22,
        padding: 16,
        marginBottom: 26,
      }}
    >
      <View style={{ gap: 3, marginLeft: 4, marginRight: 4, marginTop: 1, marginBottom: 13 }}>
        <AppText variant="body" style={{ fontSize: 16 }}>
          {t('profile.themeTitle')}
        </AppText>
        <AppText variant="caption" color="inkFaint" style={{ textTransform: 'none' }}>
          {hint}
        </AppText>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 4,
          borderRadius: 999,
          backgroundColor: theme.palette.lineSoft,
        }}
      >
        {THEME_CHOICES.map((choice) => (
          <ThemeChoiceButton
            key={choice}
            choice={choice}
            chosen={settings.theme === choice}
            t={t}
            onPress={() => {
              props.onChange({ ...settings, theme: choice });
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ThemeChoiceButton(props: {
  readonly choice: ThemeChoice;
  readonly chosen: boolean;
  readonly t: Translate;
  readonly onPress: () => void;
}): React.JSX.Element {
  return (
    <Segment
      label={props.t(THEME_LABELS[props.choice])}
      chosen={props.chosen}
      onPress={props.onPress}
      glyph={(colour) => <ThemeGlyph choice={props.choice} colour={colour} />}
    />
  );
}

/**
 * The morning affirmation (owner's word, 2026-11-06): a switch, and once it
 * is on, how often. The name's line says when it comes; off, it says what
 * it is.
 *
 * Without a subscription it comes monthly (owner's word, 2026-11-17): that
 * one is lit whatever was chosen before, and daily and weekly carry the lock
 * and open the subscription. What was chosen is kept, so subscribing brings
 * it back.
 */
function Affirmations(props: {
  readonly settings: Settings;
  readonly t: Translate;
  readonly onChange: (settings: Settings) => void;
  readonly readsAll: boolean;
  readonly onOpenSubscription: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { settings, t } = props;
  const on = settings.affirmationsOn;
  const frequency = affirmationFrequencyFor(settings.affirmationFrequency, props.readsAll);

  return (
    <Section>
      <Row
        title={t('profile.affirmations')}
        hint={t(on ? FREQUENCY_HINTS[frequency] : 'profile.affirmationsOffHint')}
      >
        <Switch
          value={on}
          onValueChange={(next) => {
            props.onChange({ ...settings, affirmationsOn: next });
          }}
          trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
          accessibilityLabel={t('profile.affirmations')}
        />
      </Row>
      {on ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            padding: 4,
            borderRadius: 999,
            backgroundColor: theme.palette.lineSoft,
            marginBottom: 18,
          }}
        >
          {FREQUENCIES.map((each) => {
            const label = t(FREQUENCY_LABELS[each]);
            const locked = affirmationFrequencyFor(each, props.readsAll) !== each;

            return (
              <Segment
                key={each}
                label={label}
                accessibilityLabel={locked ? t('profile.affirmationsLocked', { label }) : undefined}
                chosen={frequency === each}
                onPress={() => {
                  if (locked) {
                    props.onOpenSubscription();

                    return;
                  }

                  props.onChange({ ...settings, affirmationFrequency: each });
                }}
                // Never lit while locked, so the lock wears the unlit label's colour.
                glyph={locked ? () => <Icon name="lock" size={13} color="inkSoft" /> : undefined}
              />
            );
          })}
        </View>
      ) : null}
    </Section>
  );
}

/** One choice in a track of them: the theme's three, the affirmation's three. */
function Segment(props: {
  readonly label: string;
  /** Read aloud in place of the label, where the glyph says something the label does not. */
  readonly accessibilityLabel?: string;
  readonly chosen: boolean;
  readonly onPress: () => void;
  readonly glyph?: (colour: string) => React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const colour = props.chosen ? theme.palette.ink : theme.palette.inkSoft;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ selected: props.chosen }}
      onPress={props.onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: 999,
        backgroundColor: props.chosen ? theme.palette.paper : 'transparent',
        // Lifted rather than outlined: a border inside a track this tight
        // reads as a second track.
        shadowColor: '#000',
        shadowOpacity: props.chosen ? 0.1 : 0,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      {props.glyph?.(colour)}
      <AppText variant="secondary" style={{ color: colour }}>
        {props.label}
      </AppText>
    </Pressable>
  );
}

/** The drawing's own three: a sun, a moon and a phone. */
function ThemeGlyph(props: {
  readonly choice: ThemeChoice;
  readonly colour: string;
}): React.JSX.Element {
  const line = {
    fill: 'none',
    stroke: props.colour,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      {props.choice === 'light' ? (
        <Path
          d="M12 7.4a4.6 4.6 0 100 9.2 4.6 4.6 0 000-9.2M12 2.6v1.9M12 19.5v1.9M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.6 12h1.9M19.5 12h1.9M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          {...line}
        />
      ) : props.choice === 'dark' ? (
        <Path d="M20.4 14.3A8.6 8.6 0 019.7 3.6a8.6 8.6 0 1010.7 10.7z" {...line} />
      ) : (
        <Path
          d="M8.2 3h7.6c.9 0 1.6.7 1.6 1.6v14.8c0 .9-.7 1.6-1.6 1.6H8.2c-.9 0-1.6-.7-1.6-1.6V4.6c0-.9.7-1.6 1.6-1.6M10.6 18.3h2.8"
          {...line}
        />
      )}
    </Svg>
  );
}

/** The drawing's row action: an ink ring with the verb inside, never filled. */
function Pill(props: { readonly label: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: theme.palette.ink,
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 18,
      }}
    >
      <AppText variant="secondary" style={{ color: theme.palette.ink }}>
        {props.label}
      </AppText>
    </View>
  );
}

/*
 * A card of rows and nothing over it. The drawing captions each group —
 * "Plans", "Conversation" — and the owner took every caption off on
 * 2026-09-17: the rows name themselves.
 */
function Section(props: {
  readonly children: React.ReactNode;
  /** A quiet line under the card, aligned with the rows' text. */
  readonly footer?: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ marginBottom: 26 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.palette.line,
          backgroundColor: theme.palette.paper,
          borderRadius: 22,
          paddingVertical: 0,
          paddingHorizontal: 20,
        }}
      >
        {props.children}
      </View>
      {props.footer === undefined ? null : (
        <AppText
          variant="secondary"
          color="inkFaint"
          style={{ fontSize: 13, lineHeight: 19, marginTop: 12, paddingHorizontal: 20 }}
        >
          {props.footer}
        </AppText>
      )}
    </View>
  );
}

/** A backup's progress: recordings packed so far, of how many. */
export interface BackupProgress {
  readonly done: number;
  readonly total: number;
}

/**
 * The backup row's line: what it does, or — while a backup with its voice is
 * being packed (owner's word, 2026-11-18) — how far it has got, so a year of
 * recordings taking a while does not read as the app having stalled. Once a
 * backup has been handed over, the line is its day instead (owner's word,
 * 2026-11-19), in the same quiet grey however long ago it was.
 */
function backupHint(
  progress: BackupProgress | null,
  lastBackup: Date | null,
  today: Date,
  locale: Locale,
  t: Translate,
): string {
  if (progress === null) {
    return lastBackup === null
      ? t('profile.backupHint')
      : t('profile.backupLast', { when: backupWhen(lastBackup, today, locale, t) });
  }

  return progress.total === 0
    ? t('profile.backupPreparing')
    : t('profile.backupProgress', { done: progress.done, total: progress.total });
}

/** The readable export's line, the same way: what it does, or how far it has got. */
function exportHint(progress: BackupProgress | null, t: Translate): string {
  if (progress === null) {
    return t('profile.exportMdHint');
  }

  return progress.total === 0
    ? t('profile.exportPreparing')
    : t('profile.exportProgress', { done: progress.done, total: progress.total });
}

function Row(props: {
  readonly title: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
  readonly onPress?: () => void;
}): React.JSX.Element {
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        minHeight: 52,
        paddingVertical: 17,
      }}
    >
      <View style={{ flex: 1 }}>
        <Heading title={props.title} hint={props.hint} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{props.children}</View>
    </View>
  );

  return props.onPress === undefined ? (
    body
  ) : (
    <Pressable accessibilityRole="button" accessibilityLabel={props.title} onPress={props.onPress}>
      {body}
    </Pressable>
  );
}

/** A row's name and the line under it that says how it stands. */
function Heading(props: { readonly title: string; readonly hint?: string }): React.JSX.Element {
  return (
    <View style={{ gap: 3 }}>
      <AppText variant="body" style={{ fontSize: 16 }}>
        {props.title}
      </AppText>
      {props.hint === undefined ? null : (
        <AppText variant="secondary" color="inkFaint" style={{ fontSize: 13, letterSpacing: 0 }}>
          {props.hint}
        </AppText>
      )}
    </View>
  );
}

/**
 * The hour to be nudged at, and whether to be nudged at all.
 *
 * The wheels move a draft, not the setting. Committing on every flick meant
 * the sheet closed under the finger that was still choosing — a time picker
 * that closes when you pick a time is a time picker you cannot use.
 *
 * The save button keeps the draft; the X top right, the backdrop and the system's
 * back close the sheet and leave the setting as it was (owner's word,
 * 2026-10-01). Closing used to save: with a save button on the sheet,
 * closing it is no longer agreeing to it.
 */
function TimeSheet(props: {
  readonly open: boolean;
  readonly settings: Settings;
  readonly t: Translate;
  readonly onDone: (settings: Settings) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { settings, t } = props;
  const [draft, setDraft] = useState({
    hour: settings.reminderHour,
    minute: settings.reminderMinute,
    on: settings.reminderOn,
  });

  useEffect(() => {
    // Opened again, so it starts from what is stored rather than from whatever
    // was last spun.
    if (props.open) {
      setDraft({
        hour: settings.reminderHour,
        minute: settings.reminderMinute,
        on: settings.reminderOn,
      });
    }
  }, [props.open, settings.reminderHour, settings.reminderMinute, settings.reminderOn]);

  const commit = (): void => {
    props.onDone({
      ...settings,
      reminderHour: draft.hour,
      reminderMinute: draft.minute,
      reminderOn: draft.on,
    });
  };

  return (
    <ModalSheet open={props.open} closeLabel={t('common.close')} onClose={props.onClose}>
      <View style={{ gap: 18 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <AppText variant="kicker" style={{ flexShrink: 1 }}>
            {t('time.title')}
          </AppText>
          <SheetClose label={t('common.close')} onPress={props.onClose} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 26 }}>
          <Wheel
            label={t('time.hour')}
            values={HOURS}
            value={draft.hour}
            onChange={(hour) => {
              // Spinning a wheel is asking to be reminded, so the switch
              // follows rather than having to be found afterwards.
              setDraft((current) => ({ ...current, hour, on: true }));
            }}
          />
          <Wheel
            label={t('time.minute')}
            values={MINUTES}
            value={draft.minute}
            onChange={(minute) => {
              setDraft((current) => ({ ...current, minute, on: true }));
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <AppText variant="label" style={{ flex: 1 }}>
            {t('time.remindDaily')}
          </AppText>
          <Switch
            value={draft.on}
            onValueChange={(on) => {
              setDraft((current) => ({ ...current, on }));
            }}
            trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
            accessibilityLabel={t('time.remindDaily')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={commit}
          style={{
            borderRadius: 999,
            backgroundColor: theme.palette.solid,
            paddingVertical: 15,
            alignItems: 'center',
          }}
        >
          <AppText variant="body" style={{ color: theme.palette.onSolid }}>
            {t('time.done')}
          </AppText>
        </Pressable>
      </View>
    </ModalSheet>
  );
}

/**
 * The wheel from every alarm clock ever set, because that is the gesture people
 * already have for this: flick, and the hour you want lands under the line.
 *
 * Snapping is the whole of it — a free-scrolling list would leave someone
 * stopped between two hours with no way to say which they meant.
 */
function Wheel(props: {
  readonly label: string;
  readonly values: readonly number[];
  readonly value: number;
  readonly onChange: (value: number) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const scroller = useRef<ScrollView | null>(null);
  const at = Math.max(0, props.values.indexOf(props.value));

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <AppText variant="caption" color="inkFaint">
        {props.label}
      </AppText>
      <View style={{ height: WHEEL_HEIGHT, width: 78 }}>
        {/* The line the chosen value sits on, drawn under the numbers. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: ROW_HEIGHT,
            left: 0,
            right: 0,
            height: ROW_HEIGHT,
            borderRadius: 14,
            backgroundColor: theme.palette.lineSoft,
          }}
        />
        <ScrollView
          ref={scroller}
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: at * ROW_HEIGHT }}
          contentContainerStyle={{ paddingVertical: ROW_HEIGHT }}
          onMomentumScrollEnd={(event) => {
            const landed = Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT);
            const next = props.values[Math.min(Math.max(landed, 0), props.values.length - 1)];

            if (next !== undefined && next !== props.value) {
              props.onChange(next);
            }
          }}
        >
          {props.values.map((value) => (
            <View
              key={value}
              style={{ height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppText
                variant="display"
                style={{ fontSize: 24 }}
                color={value === props.value ? 'ink' : 'inkFaint'}
              >
                {String(value).padStart(2, '0')}
              </AppText>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * The state in one line, because someone looking here wants to know whether
 * they are paying and until when — not to be sold to again.
 */
function subscriptionHint(entitlement: Entitlement): TranslationKey {
  if (entitlement === 'subscribed') {
    return 'subs.statusPaid';
  }

  return entitlement === 'trial' ? 'subs.statusTrial' : 'subs.statusFree';
}

function clockOf(settings: Settings): string {
  return `${String(settings.reminderHour).padStart(2, '0')}:${String(settings.reminderMinute).padStart(2, '0')}`;
}

