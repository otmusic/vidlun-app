import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ITranscriptionService } from '@/domain/ports/ITranscriptionService';
import { createContainer, type Container } from '@/di/container';
import { createTranslator, type Locale } from '@/i18n';
import { SPEECH_RECORDING_OPTIONS } from '@/infrastructure/audio/recordingOptions';
import { ExpoModelStorage } from '@/infrastructure/transcription/ExpoModelStorage';
import { ManualTranscriptionService } from '@/infrastructure/transcription/ManualTranscriptionService';
import { isTrialLive, isTrialSpent } from '@/domain/entities/Trial';
import { DEFAULT_SETTINGS, type Settings } from '@/domain/ports/ISettings';
import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import { SPEECH_MODEL, SpeechModelStore } from '@/infrastructure/transcription/SpeechModelStore';
import { OnDeviceTranscriptionService } from '@/infrastructure/transcription/OnDeviceTranscriptionService';
import { openParakeetEngine } from '@/infrastructure/transcription/parakeetEngine';
import { openSpeechEngine } from '@/infrastructure/transcription/whisperEngine';
import { AppText } from '@/presentation/components/AppText';
import { useCaptureFlow } from '@/presentation/hooks/useCaptureFlow';
import { CaptureFlowScreen } from '@/presentation/screens/CaptureFlowScreen';
import { OnboardingScreen } from '@/presentation/screens/OnboardingScreen';
import { Screen } from '@/presentation/screens/Screen';
import { ThemeProvider } from '@/presentation/theme/ThemeProvider';

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
        <StatusBar style="auto" />
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

  useEffect(() => {
    void container.settings.read().then(onSettingsChange);
  }, [container.settings, onSettingsChange]);

  const { fetch: fetchModel } = props.model;

  useEffect(() => {
    // Starts as soon as the app opens, onboarding or not. Nothing waits on it,
    // and the sooner it begins the sooner voice works.
    fetchModel();
  }, [fetchModel]);

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
  const now = props.container.clock.now();
  const trialStartedAt =
    props.settings.trialStartedAt === null ? null : new Date(props.settings.trialStartedAt);

  const startTrial = useCallback(() => {
    // Once. Tapping again on a spent week must not quietly renew it.
    if (props.settings.trialStartedAt === null) {
      changeSettings({ ...props.settings, trialStartedAt: new Date().toISOString() });
    }
  }, [changeSettings, props.settings]);

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
    getHomeView: container.getHomeView,
    getWeekSummary: container.getWeekSummary,
    getWeekThemes: container.getWeekThemes,
    findMoodPatterns: container.findMoodPatterns,
    getVocabularyGrowth: container.getVocabularyGrowth,
    /*
     * The free week is the whole entitlement so far. Buying what comes after
     * it is M5's, and lands behind this same pair of flags rather than beside
     * them.
     */
    hasNarrativeAccess: isTrialLive(trialStartedAt, now),
    trialSpent: isTrialSpent(trialStartedAt, now),
    clock: container.clock,
  });

  if (!props.settings.hasOnboarded) {
    return (
      <OnboardingScreen
        t={t}
        model={props.model.state}
        onAskMicrophone={() => container.microphonePermission.request()}
        onDone={() => changeSettings({ ...props.settings, hasOnboarded: true })}
      />
    );
  }

  return (
    <CaptureFlowScreen
      flow={flow}
      vocabulary={container.vocabulary}
      locale={locale}
      today={container.clock.now()}
      t={t}
      settings={props.settings}
      onSettingsChange={changeSettings}
      onStartTrial={startTrial}
    />
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
  const store = useMemo(() => new SpeechModelStore(new ExpoModelStorage()), []);
  const [state, setState] = useState<SpeechModelState>({ kind: 'absent' });

  useEffect(() => {
    void store.state().then(setState);
  }, [store]);

  const fetch = useCallback(() => {
    void store.fetch(setState).then(setState);
  }, [store]);

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
