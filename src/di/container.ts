import Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { ConfirmEntry } from '../application/use-cases/ConfirmEntry';
import { CreateTextEntry } from '../application/use-cases/CreateTextEntry';
import { CreateVoiceEntry } from '../application/use-cases/CreateVoiceEntry';
import { GetHomeView } from '../application/use-cases/GetHomeView';
import { GetWeekSummary } from '../application/use-cases/GetWeekSummary';
import { DeleteEntry } from '../application/use-cases/DeleteEntry';
import { ForgetOldRecordings } from '../application/use-cases/ForgetOldRecordings';
import { GetHistory } from '../application/use-cases/GetHistory';
import { ReviseEntry } from '../application/use-cases/ReviseEntry';
import { WriteObservation } from '../application/use-cases/WriteObservation';
import type { EmotionVocabulary } from '../domain/entities/EmotionVocabulary';
import type { IAudioRecorder } from '../domain/ports/IAudioRecorder';
import type { IHaptics } from '../domain/ports/IHaptics';
import type { IMicrophonePermission } from '../domain/ports/IMicrophonePermission';
import type { ITranscriptionService } from '../domain/ports/ITranscriptionService';
import { ClaudeNarrativeGenerator } from '../infrastructure/analysis/ClaudeNarrativeGenerator';
import { ClaudeObservationWriter } from '../infrastructure/analysis/ClaudeObservationWriter';
import { ClaudeReflectionAnalyzer } from '../infrastructure/analysis/ClaudeReflectionAnalyzer';
import { createEmotionVocabulary } from '../infrastructure/analysis/emotionVocabularyData';
import { ExpoAudioRecorder, type NativeRecorder } from '../infrastructure/audio/ExpoAudioRecorder';
import { ExpoMicrophonePermission } from '../infrastructure/audio/ExpoMicrophonePermission';
import { AsyncStorageMoodEntryRepository } from '../infrastructure/persistence/AsyncStorageMoodEntryRepository';
import { AsyncStorageRevisionLog } from '../infrastructure/persistence/AsyncStorageRevisionLog';
import { FileRecordingStore } from '../infrastructure/persistence/FileRecordingStore';
import { ExpoHaptics } from '../infrastructure/system/ExpoHaptics';
import { IntervalScheduler } from '../infrastructure/system/IScheduler';
import { SystemClock } from '../infrastructure/system/SystemClock';
import { UuidGenerator } from '../infrastructure/system/UuidGenerator';
import {
  TimedMessagesClient,
  TimedTranscriptionService,
} from '../infrastructure/diagnostics/timed';
import { readAnthropicApiKey } from './config';

export interface Container {
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly createTextEntry: CreateTextEntry;
  readonly confirmEntry: ConfirmEntry;
  readonly reviseEntry: ReviseEntry;
  readonly deleteEntry: DeleteEntry;
  readonly getHistory: GetHistory;
  readonly forgetOldRecordings: ForgetOldRecordings;
  readonly writeObservation: WriteObservation;
  readonly getHomeView: GetHomeView;
  readonly getWeekSummary: GetWeekSummary;
  readonly microphonePermission: IMicrophonePermission;
  readonly haptics: IHaptics;
  readonly vocabulary: EmotionVocabulary;
  /**
   * expo-audio hands out recorders through a React hook, so the screen creates
   * the native instance and the container only wraps it.
   */
  createAudioRecorder(native: NativeRecorder): IAudioRecorder;
}

export interface ContainerDependencies {
  /** Injected until the Whisper adapter lands, and swappable for a fake on device. */
  readonly transcription: ITranscriptionService;
}

/**
 * iOS puts recording behind the `playAndRecord` category, which by definition
 * ignores the silent switch — so expo-audio rejects `allowsRecording` unless
 * `playsInSilentMode` comes with it. Both have to be sent together; sending
 * only the first leaves the other at whatever it already was and throws.
 *
 * Luna never plays audio back, so the silent switch has nothing to suppress
 * here. This only widens the audio session, it does not make the app noisy.
 */
const enableRecordingMode = (): Promise<void> =>
  setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

/** The only place concrete classes are wired. */
export function createContainer(dependencies: ContainerDependencies): Container {
  const clock = new SystemClock();
  const idGenerator = new UuidGenerator();
  const scheduler = new IntervalScheduler();
  const vocabulary = createEmotionVocabulary();

  const anthropic = new Anthropic({
    apiKey: readAnthropicApiKey(),
    // React Native defines `window`, which the SDK reads as a browser. See the
    // debt note in ./config.ts for why this is temporary.
    dangerouslyAllowBrowser: true,
  });

  /*
   * Stage timings in development only. M4 asks for capture-to-save under ten
   * seconds and the phone came in at thirteen after the stop, so the breakdown
   * needs to be visible while that is worked on.
   */
  const messages = __DEV__ ? new TimedMessagesClient(anthropic.messages) : anthropic.messages;
  const analyzer = new ClaudeReflectionAnalyzer(messages, vocabulary);
  const observationWriter = new ClaudeObservationWriter(messages);
  const transcription = __DEV__
    ? new TimedTranscriptionService(dependencies.transcription)
    : dependencies.transcription;
  const repository = new AsyncStorageMoodEntryRepository(AsyncStorage);
  const revisionLog = new AsyncStorageRevisionLog(AsyncStorage);
  const recordings = new FileRecordingStore();

  return {
    vocabulary,
    haptics: new ExpoHaptics(),
    createVoiceEntry: new CreateVoiceEntry(
      transcription,
      analyzer,
      vocabulary,
      clock,
      idGenerator,
    ),
    createTextEntry: new CreateTextEntry(analyzer, vocabulary, clock, idGenerator),
    confirmEntry: new ConfirmEntry(repository, revisionLog, clock, recordings),
    reviseEntry: new ReviseEntry(vocabulary),
    deleteEntry: new DeleteEntry(repository, revisionLog, recordings),
    getHistory: new GetHistory(repository),
    forgetOldRecordings: new ForgetOldRecordings(recordings, clock),
    writeObservation: new WriteObservation(observationWriter),
    getHomeView: new GetHomeView(repository, clock),
    getWeekSummary: new GetWeekSummary(
      repository,
      new ClaudeNarrativeGenerator(anthropic.messages),
      clock,
    ),
    microphonePermission: new ExpoMicrophonePermission({
      getRecordingPermissionsAsync,
      requestRecordingPermissionsAsync,
    }),
    createAudioRecorder: (native) =>
      new ExpoAudioRecorder(native, enableRecordingMode, scheduler),
  };
}
