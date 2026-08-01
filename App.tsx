import { StatusBar } from 'expo-status-bar';
import { RecordingPresets, useAudioRecorder } from 'expo-audio';
import { useMemo } from 'react';
import { createContainer, type Container } from '@/di/container';
import { createTranslator, type Locale } from '@/i18n';
import { ManualTranscriptionService } from '@/infrastructure/transcription/ManualTranscriptionService';
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
  const transcription = useMemo(() => new ManualTranscriptionService(), []);
  const nativeRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const wiring = useMemo<Wiring>(() => {
    try {
      return { container: createContainer({ transcription }) };
    } catch (error) {
      return { failure: error instanceof Error ? error.message : String(error) };
    }
  }, [transcription]);

  return (
    <ThemeProvider>
      {wiring.container === undefined ? (
        <SetupNeeded detail={wiring.failure ?? ''} />
      ) : (
        <Luna container={wiring.container} nativeRecorder={nativeRecorder} />
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function Luna(props: {
  readonly container: Container;
  readonly nativeRecorder: Parameters<Container['createAudioRecorder']>[0];
}): React.JSX.Element {
  const { container } = props;
  const locale = useDeviceLocale();
  const t = useMemo(() => createTranslator(locale), [locale]);
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
    getHomeView: container.getHomeView,
  });

  return (
    <CaptureFlowScreen flow={flow} vocabulary={container.vocabulary} locale={locale} t={t} />
  );
}

/**
 * Pinned rather than detected. Reading the device language needs
 * expo-localization, and the iOS-only native alternative is exactly the kind of
 * fork §2 forbids. The audience speaks Ukrainian, so that is the honest default
 * until a settings picker lands; `en` stays the source locale everything falls
 * back to.
 */
function useDeviceLocale(): Locale {
  return 'uk';
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
