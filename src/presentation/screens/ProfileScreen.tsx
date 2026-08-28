import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, View } from 'react-native';

import type { Entitlement } from '@/domain/entities/Entitlement';
import type { Settings } from '@/domain/ports/ISettings';
import type { Translate, TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { useTheme } from '../theme/ThemeProvider';

/** The bar floats over this screen, so the last row needs room under it. */
const BOTTOM_ROOM = 118;

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

      {/*
        Development only, and it earns its place: the trial is stored rather
        than bought, so without this the paid screens can be seen once per
        install and never again.
      */}
      {__DEV__ && settings.trialStartedAt !== null ? (
        <Section label="dev">
          <Row
            title="Reset the trial week"
            hint={settings.trialStartedAt}
            onPress={() => {
              props.onChange({ ...settings, trialStartedAt: null });
            }}
          >
            <AppText variant="body" color="inkFaint">
              ×
            </AppText>
          </Row>
        </Section>
      ) : null}

      <Section label={t('profile.rhythm')}>
        <Row
          title={t('profile.reminder')}
          hint={t(settings.reminderOn ? 'profile.everyDay' : 'profile.reminderOff')}
          onPress={() => {
            setPickingTime(true);
          }}
        >
          <AppText variant="body" color="inkSoft">
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
      <Section label={t('turn.eyebrow')}>
        <Row title={t('settings.asksFirst')} hint={t('settings.asksFirstHint')}>
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

      <Section label={t('profile.look')}>
        <Row
          title={t('profile.darkTheme')}
          hint={t(settings.theme === 'dark' ? 'profile.darkOn' : 'profile.darkOff')}
        >
          {/*
            On means dark always; off means following the phone. §7.6 keeps a
            third state — light always — which this switch has no room for, so
            it stays reachable only to someone who already chose it.
          */}
          <Switch
            value={settings.theme === 'dark'}
            onValueChange={(dark) => {
              props.onChange({ ...settings, theme: dark ? 'dark' : 'system' });
            }}
            trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
            accessibilityLabel={t('profile.darkTheme')}
          />
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

      <Section label={t('profile.language')}>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            padding: 6,
            borderWidth: 1,
            borderColor: theme.palette.line,
            borderRadius: 999,
            backgroundColor: theme.palette.paper,
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
      </Section>

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
      <AppText variant="kicker" style={props.valueColor === undefined ? undefined : { color: props.valueColor }}>
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
        <AppText variant="caption" color="inkFaint" style={{ textTransform: 'none' }}>
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
    return 'subs.manageTitle';
  }

  if (entitlement === 'trial') {
    return 'subs.trialActive';
  }

  return entitlement === 'trialSpent' ? 'subs.trialOver' : 'subs.trialNote';
}

function clockOf(settings: Settings): string {
  return `${String(settings.reminderHour).padStart(2, '0')}:${String(settings.reminderMinute).padStart(2, '0')}`;
}
