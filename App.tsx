import { Alert, AppState, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ITranscriptionService } from '@/domain/ports/ITranscriptionService';
import { createContainer, type Container } from '@/di/container';
import { createTranslator, type Locale, type Translate } from '@/i18n';
import { SPEECH_RECORDING_OPTIONS } from '@/infrastructure/audio/recordingOptions';
import { AssetPackModel } from '@/infrastructure/transcription/AssetPackModel';
import { ExpoModelStorage } from '@/infrastructure/transcription/ExpoModelStorage';
import { ManualTranscriptionService } from '@/infrastructure/transcription/ManualTranscriptionService';
import { entitlementOf, readsInFull, type Entitlement } from '@/domain/entities/Entitlement';
import { emotionKey } from '@/i18n';
import { DEFAULT_SETTINGS, type Settings } from '@/domain/ports/ISettings';
import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import { SPEECH_MODEL, SpeechModelStore } from '@/infrastructure/transcription/SpeechModelStore';
import { OnDeviceTranscriptionService } from '@/infrastructure/transcription/OnDeviceTranscriptionService';
import { openParakeetEngine } from '@/infrastructure/transcription/parakeetEngine';
import { openSpeechEngine } from '@/infrastructure/transcription/whisperEngine';
import { AppText } from '@/presentation/components/AppText';
import { SplashOverlay } from '@/presentation/components/SplashOverlay';
import { Button } from '@/presentation/components/Button';
import { useCaptureFlow } from '@/presentation/hooks/useCaptureFlow';
import { CaptureFlowScreen } from '@/presentation/screens/CaptureFlowScreen';
import { OnboardingScreen } from '@/presentation/screens/OnboardingScreen';
import { Screen } from '@/presentation/screens/Screen';
import { ThemeProvider, useTheme } from '@/presentation/theme/ThemeProvider';

/**
 * How long an absence stays forgiven. Under a minute is answering a message;
 * over it, the phone has plausibly changed hands.
 */
const RELOCK_AFTER_MS = 60_000;

/** The splash holds at least this long, so a fast open is a beat, not a blink. */
const MIN_SPLASH_MS = 1_200;

/** Past this the wait stops being a wait; the quiet failure state takes over. */
const SPLASH_GIVES_UP_MS = 5_000;

interface Wiring {
  readonly container?: Container;
  readonly failure?: string;
}

/**
 * The composition root. expo-audio only hands out a recorder through a hook,
 * so the native instance is created here and the container wraps it — which
 * also keeps `src/presentation` free of any import from `src/infrastructure`.
 */
export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const locale = settings.locale;
  const model = useSpeechModel();
  const transcription = useTranscription(locale, model.state);
  const nativeRecorder = useAudioRecorder(SPEECH_RECORDING_OPTIONS);

  const wiring = useMemo<Wiring>(() => {
    try {
      return { container: createContainer({ transcription }) };
    } catch (error) {
      return { failure: error instanceof Error ? error.message : String(error) };
    }
  }, [transcription]);

  return (
    /* Gesture handler needs a root of its own, or a swipe never reaches a row. */
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider choice={settings.theme}>
      {wiring.container === undefined ? (
        <SetupNeeded detail={wiring.failure ?? ''} />
      ) : (
        <Vidlun
          container={wiring.container}
          nativeRecorder={nativeRecorder}
          locale={locale}
          settings={settings}
          onSettingsChange={setSettings}
          model={model}
        />
      )}
        <PrivacyCurtain />
        <ThemedStatusBar />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Vidlun(props: {
  readonly container: Container;
  readonly nativeRecorder: Parameters<Container['createAudioRecorder']>[0];
  readonly locale: Locale;
  readonly settings: Settings;
  readonly onSettingsChange: (settings: Settings) => void;
  readonly model: { readonly state: SpeechModelState; readonly fetch: () => void };
}): React.JSX.Element {
  const { container, locale } = props;
  const t = useMemo(() => createTranslator(locale), [locale]);
  const { onSettingsChange } = props;

  /*
   * The splash may not lift before this lands: whether the launch goes to
   * onboarding or to home is written in the settings, and revealing the
   * default's guess would flash the wrong screen at whoever returns daily.
   */
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    void container.settings.read().then((read) => {
      onSettingsChange(read);
      setSettingsLoaded(true);
    });
  }, [container.settings, onSettingsChange]);

  /*
   * Notes to support leave from an outbox, so the sheet never waits on the
   * network: whatever could not go last time goes at the next opening or
   * the next return to the foreground.
   */
  useEffect(() => {
    void container.feedback.flush();

    const watch = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void container.feedback.flush();
      }
    });

    return () => {
      watch.remove();
    };
  }, [container.feedback]);

  const changeSettings = useCallback(
    (next: Settings) => {
      onSettingsChange(next);
      void container.settings.write(next);

      /*
       * Switching this off is a request to be rid of the voice, not only to
       * stop adding to it. The screen said so before asking; this is where it
       * happens.
       */
      if (!next.keepRecordings) {
        void container.forgetAllRecordings();
      }
    },
    [container, onSettingsChange],
  );
  /*
   * Asked of the store rather than remembered: a subscription can end, start
   * or refund without this app being open, and a flag we wrote ourselves
   * would outlive it. This includes the trial — the store runs it now.
   */
  const [entitlement, setEntitlement] = useState<Entitlement>('none');

  const readStatus = useCallback(() => {
    void props.container.purchases
      .status()
      .then((status) => {
        setEntitlement(entitlementOf(status));
      })
      .catch(() => {
        // A store that will not answer is not a reason to lock someone out of
        // the rest of the app; it only means the paid half stays closed.
      });
  }, [props.container.purchases]);

  useEffect(readStatus, [readStatus]);


  const recorder = useMemo(
    () => container.createAudioRecorder(props.nativeRecorder),
    [container, props.nativeRecorder],
  );

  const flow = useCaptureFlow({
    recorder,
    haptics: container.haptics,
    transcribeTake: container.transcribeTake,
    createVoiceEntry: container.createVoiceEntry,
    createTextEntry: container.createTextEntry,
    confirmEntry: container.confirmEntry,
    reviseEntry: container.reviseEntry,
    writeObservation: container.writeObservation,
    deleteEntry: container.deleteEntry,
    getHistory: container.getHistory,
    forgetOldRecordings: container.forgetOldRecordings,
    findRecording: container.findRecording,
    keepRecordings: props.settings.keepRecordings,
    asksFirst: props.settings.asksFirst,
    canHear: props.model.state.kind === 'ready',
    parkedTake: container.parkedTake,
    microphonePermission: container.microphonePermission,
    getHomeView: container.getHomeView,
    getWeekSummary: container.getWeekSummary,
    getMonthSummary: container.getMonthSummary,
    getWeekThemes: container.getWeekThemes,
    findMoodPatterns: container.findMoodPatterns,
    searchEntries: container.searchEntries,
    getVocabularyGrowth: container.getVocabularyGrowth,
    /*
     * The free week is the whole entitlement so far. Buying what comes after
     * it is M5's, and lands behind this same pair of flags rather than beside
     * them.
     */
    hasNarrativeAccess: readsInFull(entitlement),
    clock: container.clock,
    purchases: container.purchases,
    onEntitlementChanged: readStatus,
  });

  /*
   * Whenever the preference moves, and once when the app opens: a reminder
   * scheduled by a previous install of these settings is not something the
   * phone forgets on its own. The latest settings travel through a ref so a
   * theme or language change does not cancel and reschedule notifications.
   */
  const settingsRef = useRef(props.settings);

  settingsRef.current = props.settings;

  const { reminderOn, reminderHour, reminderMinute } = props.settings;

  useEffect(() => {

    if (!reminderOn) {
      void container.reminders.cancel();

      return;
    }

    void container.reminders
      .schedule({
        at: { hour: reminderHour, minute: reminderMinute },
        text: { title: t('reminder.title'), body: t('reminder.body') },
        now: container.clock.now(),
        // The last day of the rolling week is today, and the queue is refilled
        // on every save, so an entry made this evening takes tonight's nudge
        // away rather than racing it.
        skipToday: (flow.home?.week.at(-1)?.entryCount ?? 0) > 0,
      })
      .then((scheduled) => {
        /*
         * Permission refused means nothing will ever arrive, and a switch
         * left on would be the app promising what it cannot do. Flipping it
         * back is the honest answer, and it is also the visible one.
         */
        if (!scheduled) {
          onSettingsChange({ ...settingsRef.current, reminderOn: false });
        }
      });
  }, [
    container.clock,
    container.reminders,
    flow.home,
    onSettingsChange,
    reminderOn,
    reminderHour,
    reminderMinute,
    t,
  ]);

  /*
   * The whole journal as a file in the person's hand. Built here because it
   * needs the container and the translator at once, and the profile screen
   * needs neither — it only says which of the two shapes was asked for.
   */
  const exportJournal = useCallback(
    (shape: 'backup' | 'markdown') => {
      void (async () => {
        const journal = await container.exportJournal.execute({
          labelOf: (id) => t(emotionKey(id)),
          dayOf: (date) =>
            date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
          timeOf: (date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        });

        if (journal.entryCount === 0) {
          Alert.alert(t('profile.exportEmpty'));

          return;
        }

        const day = container.clock.now().toISOString().slice(0, 10);

        await container.fileSharer.share(
          shape === 'backup' ? `vidlun-backup-${day}.json` : `vidlun-journal-${day}.md`,
          shape === 'backup' ? journal.json : journal.markdown,
        );
      })();
    },
    [container, locale, t],
  );

  /*
   * The backup coming home. Cancelling the picker is silence; an unreadable
   * file is told apart from an empty result, because "nothing new" and
   * "could not read it" call for opposite feelings.
   */
  const restoreJournal = useCallback(() => {
    void (async () => {
      try {
        const json = await container.filePicker.pickText();

        if (json === null) {
          return;
        }

        const outcome = await container.importJournal.execute(json);

        Alert.alert(
          t('profile.restoredTitle'),
          outcome.imported === 0
            ? t('profile.restoredNothing')
            : t('profile.restoredBody', { n: outcome.imported, skipped: outcome.skipped }),
        );
      } catch {
        Alert.alert(t('profile.importBadTitle'), t('profile.importBadBody'));
      }
    })();
  }, [container, t]);

  /*
   * The door. The relock decision happens on the way back in, not on the way
   * out: asking the system for Face ID while the app is still in the
   * background gets silently refused, which is how the door once showed a
   * button instead of a prompt. A short absence does not relock at all —
   * stepping out to answer a message and coming straight back is not the
   * situation the lock exists for.
   */
  const [unlocked, setUnlocked] = useState(!props.settings.appLock);
  const leftAt = useRef<number | null>(null);
  const tryUnlock = useCallback(() => {
    void container.screenLock.unlock(t('lock.reason')).then(setUnlocked);
  }, [container.screenLock, t]);

  useEffect(() => {
    if (!props.settings.appLock) {
      setUnlocked(true);

      return;
    }

    const watch = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        leftAt.current = Date.now();

        return;
      }

      if (state === 'active' && leftAt.current !== null) {
        const awayMs = Date.now() - leftAt.current;

        leftAt.current = null;

        if (awayMs > RELOCK_AFTER_MS) {
          setUnlocked(false);
        }
      }
    });

    return () => {
      watch.remove();
    };
  }, [props.settings.appLock]);

  const enableLock = useCallback(async () => {
    if (!(await container.screenLock.available())) {
      Alert.alert(t('profile.appLockUnavailableTitle'), t('profile.appLockUnavailableBody'));

      return false;
    }

    return container.screenLock.unlock(t('lock.reason'));
  }, [container.screenLock, t]);

  /*
   * The splash lifts when the journal is open — settings read, entries read —
   * but never before MIN_SPLASH_MS, so a fast phone gets a beat rather than a
   * blink. A launch that is still not open at SPLASH_GIVES_UP_MS stops
   * pretending to load and offers the retry instead.
   */
  const [splash, setSplash] = useState<'loading' | 'failed' | 'leaving' | 'gone'>('loading');
  const splashShownAt = useRef(container.clock.now().getTime());
  const ready = settingsLoaded && flow.home !== null;

  useEffect(() => {
    if (splash !== 'loading') {
      return;
    }

    if (ready) {
      const shown = container.clock.now().getTime() - splashShownAt.current;
      const lift = setTimeout(() => {
        setSplash('leaving');
      }, Math.max(0, MIN_SPLASH_MS - shown));

      return () => {
        clearTimeout(lift);
      };
    }

    const giveUp = setTimeout(() => {
      setSplash('failed');
    }, SPLASH_GIVES_UP_MS);

    return () => {
      clearTimeout(giveUp);
    };
  }, [container.clock, ready, splash]);

  const { reloadHome } = flow;

  const splashGone = useCallback(() => {
    setSplash('gone');
  }, []);

  const retryOpening = useCallback(() => {
    splashShownAt.current = container.clock.now().getTime();
    setSplash('loading');
    setSettingsLoaded(false);
    void container.settings.read().then((read) => {
      onSettingsChange(read);
      setSettingsLoaded(true);
    });
    reloadHome();
  }, [container.clock, container.settings, onSettingsChange, reloadHome]);

  const screen = !props.settings.hasOnboarded ? (
    <OnboardingScreen
      t={t}
      locale={locale}
      model={props.model.state}
      onFetchModel={props.model.fetch}
      onAskMicrophone={() => container.microphonePermission.request()}
      onDone={() => changeSettings({ ...props.settings, hasOnboarded: true })}
    />
  ) : props.settings.appLock && !unlocked ? (
    <LockedDoor t={t} onUnlock={tryUnlock} />
  ) : (
    <CaptureFlowScreen
      flow={flow}
      vocabulary={container.vocabulary}
      locale={locale}
      today={container.clock.now()}
      t={t}
      settings={props.settings}
      onSettingsChange={changeSettings}
      entitlement={entitlement}
      onExport={exportJournal}
      onRestore={restoreJournal}
      onEnableLock={enableLock}
      onFeedback={(text) => container.feedback.send(text)}
      voice={props.model.state}
      onFetchVoice={props.model.fetch}
    />
  );

  return (
    /* The next screen is already under the splash, so leaving is a crossfade. */
    <View style={{ flex: 1 }}>
      {screen}
      {splash === 'gone' ? null : (
        <SplashOverlay
          phase={splash}
          t={t}
          onRetry={retryOpening}
          onGone={splashGone}
        />
      )}
    </View>
  );
}

/**
 * Voice needs the model on disk; text never does. Until it arrives the app is
 * a working text journal rather than a broken voice one, which is the whole
 * reason half a gigabyte is not allowed to block anything.
 */
/**
 * One store for the whole app: onboarding fetches the model, transcription
 * reads the same state. Two of them would mean two downloads of half a
 * gigabyte, one of them silent.
 */
function useSpeechModel(): { readonly state: SpeechModelState; readonly fetch: () => void } {
  const store = useMemo(
    () => new SpeechModelStore(new ExpoModelStorage(), new AssetPackModel()),
    [],
  );
  const [state, setState] = useState<SpeechModelState>({ kind: 'absent' });

  /*
   * A launch reads what is on disk and continues a download an earlier
   * launch paused; it starts none. 668 MB over whatever connection the phone
   * happens to be on is the person's call — made once, by the tap on the
   * onboarding screen or on home's own line, never by the app opening.
   */
  useEffect(() => {
    void store.state().then((known) => {
      setState(known);

      if (known.kind === 'ready') {
        return;
      }

      void store.resume(setState).then((continued) => {
        if (continued !== null) {
          setState(continued);
        }
      });
    });
  }, [store]);

  const fetch = useCallback(() => {
    void store.fetch(setState).then(setState);
  }, [store]);

  /*
   * Paused on the way out, continued on the way back. A transfer left running
   * in the background would go on — until the system or the person ends the
   * app, and then all of it is gone: the platform hands back nothing for a
   * download that was dropped, only for one that was paused. Trading the
   * minutes it might have kept downloading for never losing the half a
   * gigabyte already down is the better side of that bargain.
   */
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const watch = AppState.addEventListener('change', (next) => {
      /*
       * On the way out of `active`, not only into `background`: an app swiped
       * away from the switcher never reaches `background` — it goes inactive
       * when the switcher opens and is then killed — and that was exactly the
       * download that restarted from the first byte. Pausing on a brief
       * inactive costs a resume a moment later; missing the kill costs it all.
       */
      if (next === 'inactive' || next === 'background') {
        void store.pause();
      } else if (next === 'active' && stateRef.current.kind === 'fetching') {
        fetch();
      }
    });

    return () => {
      watch.remove();
    };
  }, [fetch, store]);

  return { state, fetch };
}

/**
 * Voice needs the model on disk; text never does. Until it arrives the app is
 * a working text journal rather than a broken voice one, which is the whole
 * reason half a gigabyte is not allowed to block anything.
 */
function useTranscription(locale: Locale, model: SpeechModelState): ITranscriptionService {
  const typed = useMemo(() => new ManualTranscriptionService(), []);

  return useMemo(() => {
    if (model.kind !== 'ready') {
      return typed;
    }

    const open =
      SPEECH_MODEL.engine === 'parakeet'
        ? openParakeetEngine(model.uri)
        : openSpeechEngine(model.uri);

    return new OnDeviceTranscriptionService(open, () => locale);
  }, [locale, model, typed]);
}

/**
 * The curtain over the app-switcher snapshot. iOS photographs the screen the
 * moment the app resigns active — before backgrounding, before any relock —
 * so whatever is on screen at that instant is what strangers flip past in
 * the switcher. This blurs it, the way a journal deserves.
 */
function PrivacyCurtain(): React.JSX.Element | null {
  const theme = useTheme();
  const [resting, setResting] = useState(AppState.currentState !== 'active');

  useEffect(() => {
    const watch = AppState.addEventListener('change', (state) => {
      setResting(state !== 'active');
    });

    return () => {
      watch.remove();
    };
  }, []);

  if (!resting) {
    return null;
  }

  return (
    <BlurView
      intensity={60}
      tint={theme.isDark ? 'dark' : 'light'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}

/** The one screen shown while the journal is shut. */
function LockedDoor(props: {
  readonly t: Translate;
  readonly onUnlock: () => void;
}): React.JSX.Element {
  const { onUnlock } = props;

  /*
   * Asks as soon as the door appears, and again whenever the app returns to
   * the foreground while it is still shut: opening the app is the request.
   * The button below is only for a prompt someone dismissed by hand.
   */
  useEffect(() => {
    onUnlock();

    const watch = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        onUnlock();
      }
    });

    return () => {
      watch.remove();
    };
  }, [onUnlock]);

  return (
    <Screen centered>
      <View style={{ alignItems: 'center', gap: 14, paddingHorizontal: 32 }}>
        <AppText variant="display" align="center">
          {props.t('lock.title')}
        </AppText>
        <AppText variant="body" color="inkSoft" align="center">
          {props.t('lock.body')}
        </AppText>
        <View style={{ height: 10 }} />
        <Button label={props.t('lock.unlock')} onPress={onUnlock} />
      </View>
    </Screen>
  );
}

/**
 * The clock and the battery follow the app's own theme, not the phone's:
 * "auto" asked the system, and a phone in dark mode painted white digits
 * onto the app's cream canvas.
 */
function ThemedStatusBar(): React.JSX.Element {
  const theme = useTheme();

  return <StatusBar style={theme.isDark ? 'light' : 'dark'} />;
}

/** Shown when the api key is missing, which is a developer state, not a user one. */
function SetupNeeded(props: { readonly detail: string }): React.JSX.Element {
  return (
    <Screen centered>
      <AppText variant="body" align="center">
        {props.detail}
      </AppText>
    </Screen>
  );
}
