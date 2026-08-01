import { StatusBar } from 'expo-status-bar';
import { RecordingPresets, useAudioRecorder } from 'expo-audio';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createContainer, type Container } from '@/di/container';
import { createTranslator, DEFAULT_LOCALE } from '@/i18n';
import { ManualTranscriptionService } from '@/infrastructure/transcription/ManualTranscriptionService';
import { DiagnosticsScreen } from '@/presentation/screens/DiagnosticsScreen';

const t = createTranslator(DEFAULT_LOCALE);

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

  const recorder = useMemo(
    () => wiring.container?.createAudioRecorder(nativeRecorder),
    [nativeRecorder, wiring.container],
  );

  if (wiring.container === undefined || recorder === undefined) {
    return (
      <View style={styles.setup}>
        <Text style={styles.setupText}>{t('dev.missingKey')}</Text>
        <Text style={styles.setupDetail}>{wiring.failure ?? ''}</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      <DiagnosticsScreen
        microphonePermission={wiring.container.microphonePermission}
        recorder={recorder}
        setTranscript={(text) => {
          transcription.setTranscript(text);
        }}
        createVoiceEntry={wiring.container.createVoiceEntry}
        confirmEntry={wiring.container.confirmEntry}
      />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  setup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#EDF2F1',
  },
  setupText: { fontSize: 16, lineHeight: 25.6, textAlign: 'center', color: '#26302F' },
  setupDetail: { fontSize: 14, textAlign: 'center', color: '#61706E' },
});
