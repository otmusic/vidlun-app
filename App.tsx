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
import { DEFAULT_SETTINGS, type Settings } from '@/domain/ports/ISettings';
import { SPEECH_MODEL, SpeechModelStore } from '@/infrastructure/transcription/SpeechModelStore';
import { OnDeviceTranscriptionService } from '@/infrastructure/transcription/OnDeviceTranscriptionService';
import { openParakeetEngine } from '@/infrastructure/transcription/parakeetEngine';
import { openSpeechEngine } from '@/infrastructure/transcription/whisperEngine';
import { AppText } from '@/presentation/components/AppText';
import { useCaptureFlow } from '@/presentation/hooks/useCaptureFlow';
import { CaptureFlowScreen } from '@/presentation/screens/CaptureFlowScreen';
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
  const transcription = useTranscription(locale);
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
      <ThemeProvider>
      {wiring.container === undefined ? (
        <SetupNeeded detail={wiring.failure ?? ''} />
      ) : (
        <Luna
          container={wiring.container}
          nativeRecorder={nativeRecorder}
          locale={locale}
          settings={settings}
          onSettingsChange={setSettings}
        />
      )}
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Luna(props: {
  readonly container: Container;
  readonly nativeRecorder: Parameters<Container['createAudioRecorder']>[0];
  readonly locale: Locale;
  readonly settings: Settings;
  readonly onSettingsChange: (settings: Settings) => void;
}): React.JSX.Element {
  const { container, locale } = props;
  const t = useMemo(() => createTranslator(locale), [locale]);
  const { onSettingsChange } = props;

  useEffect(() => {
    void container.settings.read().then(onSettingsChange);
  }, [container.settings, onSettingsChange]);

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
  const recorder = useMemo(
    () => container.createAudioRecorder(props.nativeRecorder),
    [container, props.nativeRecorder],
  );

  const flow = useCaptureFlow({
    recorder,
    haptics: container.haptics,
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
    getHomeView: container.getHomeView,
  });

  return (
    <CaptureFlowScreen
      flow={flow}
      vocabulary={container.vocabulary}
      locale={locale}
      t={t}
      settings={props.settings}
      onSettingsChange={changeSettings}
    />
  );
}

/**
 * Voice needs the model on disk; text never does. Until it arrives the app is
 * a working text journal rather than a broken voice one, which is the whole
 * reason half a gigabyte is not allowed to block anything.
 */
function useTranscription(locale: Locale): ITranscriptionService {
  const typed = useMemo(() => new ManualTranscriptionService(), []);
  const [spoken, setSpoken] = useState<ITranscriptionService | null>(null);

  useEffect(() => {
    let abandoned = false;
    const store = new SpeechModelStore(new ExpoModelStorage());

    void store.state().then((state) => {
      if (abandoned || state.kind !== 'ready') {
        return;
      }

      const open =
        SPEECH_MODEL.engine === 'parakeet'
          ? openParakeetEngine(state.uri)
          : openSpeechEngine(state.uri);

      setSpoken(new OnDeviceTranscriptionService(open, () => locale));
    });

    return () => {
      abandoned = true;
    };
  }, [locale]);

  return spoken ?? typed;
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
