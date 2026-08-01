import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ConfirmEntry } from '@/application/use-cases/ConfirmEntry';
import type { CreateVoiceEntry } from '@/application/use-cases/CreateVoiceEntry';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { AudioRecording, IAudioRecorder } from '@/domain/ports/IAudioRecorder';
import type { IMicrophonePermission, PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import { createTranslator, DEFAULT_LOCALE } from '@/i18n';

const t = createTranslator(DEFAULT_LOCALE);

export interface DiagnosticsScreenProps {
  readonly microphonePermission: IMicrophonePermission;
  readonly recorder: IAudioRecorder;
  readonly setTranscript: (text: string) => void;
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly confirmEntry: ConfirmEntry;
}

/**
 * Exercises everything M1 to M3 built, on a real device, before the capture
 * screens exist. It is a harness, not a design: nothing here survives M4.
 */
export function DiagnosticsScreen(props: DiagnosticsScreenProps): React.JSX.Element {
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscriptText] = useState('');
  const [draft, setDraft] = useState<MoodEntry | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = useCallback(async (work: () => Promise<void>): Promise<void> => {
    setFailure(null);
    setBusy(true);

    try {
      await work();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const askForMicrophone = useCallback(() => {
    void run(async () => {
      setPermission(await props.microphonePermission.request());
    });
  }, [props.microphonePermission, run]);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setFailure(null);

    props.recorder
      .start()
      .then((take) => {
        setRecording(take);
      })
      .catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        setIsRecording(false);
      });
  }, [props.recorder]);

  const analyze = useCallback(() => {
    void run(async () => {
      props.setTranscript(transcript);
      setDraft(
        await props.createVoiceEntry.execute(
          recording ?? { uri: 'typed', durationMs: 0 },
        ),
      );
    });
  }, [props, recording, run, transcript]);

  const save = useCallback(() => {
    if (draft === null) {
      return;
    }

    void run(async () => {
      await props.confirmEntry.execute({ proposed: draft, confirmed: draft });
      setSavedCount((count) => count + 1);
      setDraft(null);
    });
  }, [draft, props.confirmEntry, run]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('dev.title')}</Text>
      <Text style={styles.hint}>{t('dev.subtitle')}</Text>

      <Section label={t('dev.microphone')} value={permission ?? t('dev.none')}>
        <Button label={t('dev.requestPermission')} onPress={askForMicrophone} disabled={busy} />
      </Section>

      <Section
        label={t('dev.recordingResult')}
        value={recording === null ? t('dev.none') : `${recording.durationMs} ms`}
      >
        <Button
          label={isRecording ? t('dev.stopRecording') : t('dev.record')}
          onPress={isRecording ? () => { props.recorder.stop(); } : startRecording}
          disabled={busy}
        />
      </Section>

      <Section label={t('dev.transcript')} value={t('dev.transcriptHint')}>
        <TextInput
          style={styles.input}
          value={transcript}
          onChangeText={setTranscriptText}
          multiline
        />
        <Button
          label={t('dev.analyze')}
          onPress={analyze}
          disabled={busy || transcript.trim().length === 0}
        />
      </Section>

      {draft !== null ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t('dev.draft')}</Text>
          <Text style={styles.value}>{`${t('dev.mood')}: ${draft.mood.value}`}</Text>
          <Text style={styles.value}>
            {`${t('dev.emotions')}: ${draft.emotionIds.join(', ') || t('dev.none')}`}
          </Text>
          <Text style={styles.value}>
            {`${t('dev.tags')}: ${draft.contextTags.join(', ') || t('dev.none')}`}
          </Text>
          <Text style={styles.value}>
            {`${t('dev.observation')}: ${draft.observation ?? t('dev.none')}`}
          </Text>
          <Button label={t('dev.confirm')} onPress={save} disabled={busy} />
        </View>
      ) : null}

      <Text style={styles.value}>{`${t('dev.savedCount')}: ${savedCount}`}</Text>
      {busy ? <Text style={styles.hint}>{t('dev.busy')}</Text> : null}
      {failure !== null ? <Text style={styles.failure}>{failure}</Text> : null}
    </ScrollView>
  );
}

function Section(props: {
  readonly label: string;
  readonly value: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{props.label}</Text>
      <Text style={styles.value}>{props.value}</Text>
      {props.children}
    </View>
  );
}

function Button(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.button, props.disabled ? styles.buttonDisabled : null]}
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
    >
      <Text style={styles.buttonLabel}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EDF2F1' },
  content: { padding: 16, gap: 16, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 25, color: '#26302F' },
  hint: { fontSize: 14, color: '#61706E' },
  card: { backgroundColor: '#FAFBFB', borderRadius: 14, padding: 16, gap: 8 },
  label: { fontSize: 11.5, letterSpacing: 0.5, color: '#93A09D', textTransform: 'uppercase' },
  value: { fontSize: 16, lineHeight: 25.6, color: '#26302F' },
  input: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E6E6',
    padding: 16,
    fontSize: 16,
    color: '#26302F',
  },
  button: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#3E7C82',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { fontSize: 15, color: '#FFFFFF' },
  failure: { fontSize: 14, color: '#8F4530' },
});
