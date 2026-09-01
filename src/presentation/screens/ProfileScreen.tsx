import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, useColorScheme, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Entitlement } from '@/domain/entities/Entitlement';
import type { Settings, ThemeChoice } from '@/domain/ports/ISettings';
import type { Translate, TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { useTheme } from '../theme/ThemeProvider';

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
const ROW_HEIGHT = 46;
const WHEEL_HEIGHT = ROW_HEIGHT * 3;

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);
/** Five-minute steps: nobody sets a journal reminder for 21:37. */
const MINUTES = Array.from({ length: 12 }, (_unused, at) => at * 5);

/**
 * The person's own corner: what they have made, and the handful of things they
 * get to decide.
 *
 * Two numbers at the top and nothing else quantified. Entries and days in a row
 * are counts of what someone did, not scores on how they are — the difference
 * between those two is the whole reason the insights screen has no headline
 * number either.
 */
export function ProfileScreen(props: {
  readonly entryCount: number | null;
  readonly streakDays: number;
  readonly settings: Settings;
  readonly t: Translate;
  readonly onChange: (settings: Settings) => void;
  readonly entitlement: Entitlement;
  readonly onOpenSubscription: () => void;
  /** Hands one export file to the share sheet; null label means nothing yet. */
  readonly onExport: (shape: 'backup' | 'markdown') => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { settings, t } = props;
  const [pickingTime, setPickingTime] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: BOTTOM_ROOM }}
    >
      <AppText variant="display" style={{ marginBottom: 22 }}>
        {t('profile.title')}
      </AppText>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 26 }}>
        <Tile
          value={props.entryCount === null ? '—' : String(props.entryCount)}
          unit={t('profile.entriesUnit')}
          background={theme.palette.limeSoft}
        />
        <Tile
          value={String(props.streakDays)}
          unit={t('profile.streakUnit')}
          background={theme.palette.voiceSoft}
          valueColor={theme.palette.accentInk}
        />
      </View>

      <Section label={t('subs.section')}>
        <Row
          title={t('subs.name')}
          hint={t(subscriptionHint(props.entitlement))}
          onPress={props.onOpenSubscription}
        >
          <AppText variant="body" color="inkFaint">
            ›
          </AppText>
        </Row>
      </Section>

      <Section label={t('profile.rhythm')}>
        <Row
          title={t('profile.reminder')}
          hint={t(settings.reminderOn ? 'profile.everyDay' : 'profile.reminderOff')}
          onPress={() => {
            setPickingTime(true);
          }}
        >
          <AppText variant="numeric" style={{ fontSize: 17 }}>
            {clockOf(settings)}
          </AppText>
          <AppText variant="body" color="inkFaint">
            ›
          </AppText>
        </Row>
      </Section>

      {/*
        Not in the drawing, and added at the owner's request: the card's
        question is §M6's whole point, so whether it is asked belongs where
        someone would look for it rather than nowhere. Needs a block of its own
        in `Vidlun.dc.html`.
      */}
      <Section label={t('profile.conversation')}>
        <Row
          title={t('settings.asksFirst')}
          hint={t(settings.asksFirst ? 'settings.asksFirstOn' : 'settings.asksFirstOff')}
        >
          <Switch
            value={settings.asksFirst}
            onValueChange={(asksFirst) => {
              props.onChange({ ...settings, asksFirst });
            }}
            trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
            accessibilityLabel={t('settings.asksFirst')}
          />
        </Row>
      </Section>

      <Theme settings={settings} t={t} onChange={props.onChange} />

      {/*
        The paywall's free-forever list promises backup; this is where the
        promise is kept. Two shapes on purpose: the JSON file is the copy
        that comes back, the markdown one is for reading somewhere else.
        No drawing exists for this section yet — it wears Row like the rest.
      */}
      <Section label={t('profile.data')}>
        <Row
          title={t('profile.backup')}
          hint={t('profile.backupHint')}
          onPress={() => {
            props.onExport('backup');
          }}
        >
          <AppText variant="body" color="inkFaint">
            ›
          </AppText>
        </Row>
        <Row
          title={t('profile.exportMd')}
          hint={t('profile.exportMdHint')}
          onPress={() => {
            props.onExport('markdown');
          }}
        >
          <AppText variant="body" color="inkFaint">
            ›
          </AppText>
        </Row>
      </Section>

      <Section label={t('profile.audio')}>
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
      <AppText variant="secondary" color="inkFaint" style={{ marginTop: 10, marginBottom: 26 }}>
        {t('profile.audioNote')}
      </AppText>

      {/*
        No card around this one, unlike every other section: the drawing has the
        label sitting straight above the pill, and wrapping it produced a border
        inside a border with the section's padding between them.
      */}
      <AppText variant="caption" color="inkFaint" style={{ marginBottom: 10 }}>
        {t('profile.language')}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          padding: 6,
          borderWidth: 1,
          borderColor: theme.palette.line,
          borderRadius: 999,
          backgroundColor: theme.palette.paper,
          marginBottom: 30,
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
                borderRadius: 999,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: chosen ? theme.palette.solid : 'transparent',
              }}
            >
              <AppText
                variant="body"
                style={{ color: chosen ? theme.palette.onSolid : theme.palette.ink }}
              >
                {t(`language.${locale}` as TranslationKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <TimeSheet
        open={pickingTime}
        settings={settings}
        t={t}
        onDone={(next) => {
          setPickingTime(false);
          props.onChange(next);
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
  const scheme = useColorScheme();
  const { settings, t } = props;

  const hint =
    settings.theme === 'system'
      ? t('profile.themeHintSystem', {
          now: t(scheme === 'dark' ? 'profile.themeNowDark' : 'profile.themeNowLight'),
        })
      : t(settings.theme === 'dark' ? 'profile.themeHintDark' : 'profile.themeHintLight');

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
  const theme = useTheme();
  const colour = props.chosen ? theme.palette.ink : theme.palette.inkSoft;

  return (
    <Pressable
      accessibilityRole="button"
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
      <ThemeGlyph choice={props.choice} colour={colour} />
      <AppText variant="secondary" style={{ color: colour }}>
        {props.t(THEME_LABELS[props.choice])}
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

function Tile(props: {
  readonly value: string;
  readonly unit: string;
  readonly background: string;
  readonly valueColor?: string;
}): React.JSX.Element {
  return (
    <View
      style={{ flex: 1, borderRadius: 22, backgroundColor: props.background, padding: 20 }}
    >
      <AppText
        variant="display"
        style={[{ fontSize: 26 }, props.valueColor === undefined ? null : { color: props.valueColor }]}
      >
        {props.value}
      </AppText>
      <AppText variant="secondary" color="inkSoft" style={{ marginTop: 4 }}>
        {props.unit}
      </AppText>
    </View>
  );
}

function Section(props: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ marginBottom: 26 }}>
      <AppText variant="caption" color="inkFaint" style={{ marginBottom: 10 }}>
        {props.label}
      </AppText>
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
    </View>
  );
}

function Row(props: {
  readonly title: string;
  readonly hint: string;
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
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="body" style={{ fontSize: 16 }}>
          {props.title}
        </AppText>
        <AppText
          variant="secondary"
          color="inkFaint"
          style={{ fontSize: 13, letterSpacing: 0 }}
        >
          {props.hint}
        </AppText>
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

/**
 * The hour to be nudged at, and whether to be nudged at all.
 *
 * The wheels move a draft, not the setting. Committing on every flick meant
 * the sheet closed under the finger that was still choosing — a time picker
 * that closes when you pick a time is a time picker you cannot use.
 *
 * Closing commits, whether by the button or by the scrim: nobody expects a
 * clock to discard the hour they just set.
 */
function TimeSheet(props: {
  readonly open: boolean;
  readonly settings: Settings;
  readonly t: Translate;
  readonly onDone: (settings: Settings) => void;
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
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={commit}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('time.done')}
          onPress={commit}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            backgroundColor: theme.palette.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            paddingHorizontal: 20,
            paddingBottom: 26,
            gap: 18,
          }}
        >
          <View style={{ gap: 6 }}>
            <AppText variant="kicker">{t('time.title')}</AppText>
            <AppText variant="body" color="inkSoft">
              {t('time.body')}
            </AppText>
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
      </View>
    </Modal>
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
