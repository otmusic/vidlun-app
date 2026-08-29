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
import { TranscribeTake } from '../application/use-cases/TranscribeTake';
import { GetHomeView } from '../application/use-cases/GetHomeView';
import { FindMoodPatterns } from '../application/use-cases/FindMoodPatterns';
import { GetVocabularyGrowth } from '../application/use-cases/GetVocabularyGrowth';
import { GetWeekSummary } from '../application/use-cases/GetWeekSummary';
import { GetWeekThemes } from '../application/use-cases/GetWeekThemes';
import { SearchEntries } from '../application/use-cases/SearchEntries';
import { DeleteEntry } from '../application/use-cases/DeleteEntry';
import { FindRecording } from '../application/use-cases/FindRecording';
import { ForgetOldRecordings } from '../application/use-cases/ForgetOldRecordings';
import { GetHistory } from '../application/use-cases/GetHistory';
import { ReviseEntry } from '../application/use-cases/ReviseEntry';
import { WriteObservation } from '../application/use-cases/WriteObservation';
import type { EmotionVocabulary } from '../domain/entities/EmotionVocabulary';
import type { IAudioRecorder } from '../domain/ports/IAudioRecorder';
import type { IClock } from '../domain/ports/IClock';
import type { IHaptics } from '../domain/ports/IHaptics';
import type { IMicrophonePermission } from '../domain/ports/IMicrophonePermission';
import type { IPurchases, PurchaseOutcome } from '../domain/ports/IPurchases';
import type { IReminders } from '../domain/ports/IReminders';
import type { ITranscriptionService } from '../domain/ports/ITranscriptionService';
import { CachedNarrativeGenerator } from '../infrastructure/analysis/CachedNarrativeGenerator';
import { ClaudeNarrativeGenerator } from '../infrastructure/analysis/ClaudeNarrativeGenerator';
import { ClaudeObservationWriter } from '../infrastructure/analysis/ClaudeObservationWriter';
import { ClaudeReflectionAnalyzer } from '../infrastructure/analysis/ClaudeReflectionAnalyzer';
import { createEmotionVocabulary } from '../infrastructure/analysis/emotionVocabularyData';
import { ExpoAudioRecorder, type NativeRecorder } from '../infrastructure/audio/ExpoAudioRecorder';
import { ExpoMicrophonePermission } from '../infrastructure/audio/ExpoMicrophonePermission';
import { AsyncStorageMoodEntryRepository } from '../infrastructure/persistence/AsyncStorageMoodEntryRepository';
import { AsyncStorageRevisionLog } from '../infrastructure/persistence/AsyncStorageRevisionLog';
import { FileRecordingStore } from '../infrastructure/persistence/FileRecordingStore';
import { detectLocale } from '../infrastructure/settings/deviceLocale';
import { SettingsStore } from '../infrastructure/settings/SettingsStore';
import { ExpoHaptics } from '../infrastructure/system/ExpoHaptics';
import { IntervalScheduler } from '../infrastructure/system/IScheduler';
import { ExpoReminders } from '../infrastructure/system/ExpoReminders';
import { SystemClock } from '../infrastructure/system/SystemClock';
import { FakePurchases } from '../infrastructure/purchases/FakePurchases';
import { RevenueCatPurchases } from '../infrastructure/purchases/RevenueCatPurchases';
import { UnavailablePurchases } from '../infrastructure/purchases/UnavailablePurchases';
import { UuidGenerator } from '../infrastructure/system/UuidGenerator';
import {
  TimedMessagesClient,
  TimedReflectionAnalyzer,
  TimedTranscriptionService,
} from '../infrastructure/diagnostics/timed';
import {
  readAnthropicApiKey,
  readFakePurchaseOutcome,
  readProxy,
  readRevenueCatKey,
} from './config';

export interface Container {
  readonly transcribeTake: TranscribeTake;
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly createTextEntry: CreateTextEntry;
  readonly confirmEntry: ConfirmEntry;
  readonly reviseEntry: ReviseEntry;
  readonly deleteEntry: DeleteEntry;
  readonly getHistory: GetHistory;
  readonly forgetOldRecordings: ForgetOldRecordings;
  readonly findRecording: FindRecording;
  readonly settings: SettingsStore;
  readonly forgetAllRecordings: () => Promise<void>;
  readonly writeObservation: WriteObservation;
  readonly getHomeView: GetHomeView;
  readonly getWeekSummary: GetWeekSummary;
  readonly getWeekThemes: GetWeekThemes;
  readonly findMoodPatterns: FindMoodPatterns;
  readonly searchEntries: SearchEntries;
  readonly purchases: IPurchases;
  readonly reminders: IReminders;
  readonly getVocabularyGrowth: GetVocabularyGrowth;
  readonly microphonePermission: IMicrophonePermission;
  readonly haptics: IHaptics;
  readonly vocabulary: EmotionVocabulary;
  /** The screens need one too — the insights screen counts backwards from today. */
  readonly clock: IClock;
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
 * Vidlun never plays audio back, so the silent switch has nothing to suppress
 * here. This only widens the audio session, it does not make the app noisy.
 */
const enableRecordingMode = (): Promise<void> =>
  setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

/**
 * Without a key there is no store, and the screens say that plainly instead of
 * failing somewhere deep in a native module.
 */
function purchasesFor(apiKey: string | null): IPurchases {
  const scripted = readFakePurchaseOutcome();

  /*
   * The pretend store is gated on `__DEV__` as well as on its own flag, so a
   * release build cannot be talked into granting anything however the
   * environment is set.
   */
  if (__DEV__ && scripted !== null) {
    return new FakePurchases(scripted as PurchaseOutcome, scripted === 'active');
  }

  return apiKey === null ? new UnavailablePurchases() : new RevenueCatPurchases(apiKey);
}

/** The only place concrete classes are wired. */
export function createContainer(dependencies: ContainerDependencies): Container {
  const clock = new SystemClock();
  const idGenerator = new UuidGenerator();
  const scheduler = new IntervalScheduler();
  const vocabulary = createEmotionVocabulary();

  /*
   * Through the proxy where one is configured, straight to Anthropic where it
   * is not. The SDK sends its key as `x-api-key` either way, so the proxy
   * reads the app's token out of that same header and swaps in the real one —
   * which is why this is a base URL change and nothing more.
   */
  const proxy = readProxy();
  const anthropic = new Anthropic({
    apiKey: proxy?.token ?? readAnthropicApiKey(),
    baseURL: proxy === null ? undefined : proxy.baseUrl,
    // React Native defines `window`, which the SDK reads as a browser.
    dangerouslyAllowBrowser: true,
  });

  /*
   * Stage timings in development only. M4 asks for capture-to-save under ten
   * seconds and the phone came in at thirteen after the stop, so the breakdown
   * needs to be visible while that is worked on.
   */
  const messages = __DEV__ ? new TimedMessagesClient(anthropic.messages) : anthropic.messages;
  const reflection = new ClaudeReflectionAnalyzer(messages, vocabulary);
  /*
   * The card shows the repaired transcript, so the two rewriters on this path
   * — the recogniser and this prompt — are indistinguishable from the outside.
   * Printing both is the only way to tell whose word a wrong word is.
   */
  const analyzer = __DEV__ ? new TimedReflectionAnalyzer(reflection) : reflection;
  const observationWriter = new ClaudeObservationWriter(messages);
  const transcription = __DEV__
    ? new TimedTranscriptionService(dependencies.transcription)
    : dependencies.transcription;
  const repository = new AsyncStorageMoodEntryRepository(AsyncStorage);
  const revisionLog = new AsyncStorageRevisionLog(AsyncStorage);
  const recordings = new FileRecordingStore();

  return {
    vocabulary,
    clock,
    haptics: new ExpoHaptics(),
    transcribeTake: new TranscribeTake(transcription),
    createVoiceEntry: new CreateVoiceEntry(analyzer, vocabulary, clock, idGenerator),
    createTextEntry: new CreateTextEntry(analyzer, vocabulary, clock, idGenerator),
    confirmEntry: new ConfirmEntry(repository, revisionLog, clock, recordings),
    reviseEntry: new ReviseEntry(vocabulary),
    deleteEntry: new DeleteEntry(repository, revisionLog, recordings),
    getHistory: new GetHistory(repository),
    forgetOldRecordings: new ForgetOldRecordings(recordings, clock),
    findRecording: new FindRecording(recordings),
    settings: new SettingsStore(AsyncStorage, detectLocale),
    // Everything up to now, which is everything: turning the setting off is a
    // request to be rid of the voice, not only to stop adding to it.
    forgetAllRecordings: () => recordings.discardBefore(clock.now()),
    writeObservation: new WriteObservation(observationWriter),
    getHomeView: new GetHomeView(repository, clock),
    getWeekSummary: new GetWeekSummary(
      repository,
      new CachedNarrativeGenerator(
        new ClaudeNarrativeGenerator(anthropic.messages),
        AsyncStorage,
      ),
      clock,
    ),
    getWeekThemes: new GetWeekThemes(repository),
    findMoodPatterns: new FindMoodPatterns(repository, clock),
    searchEntries: new SearchEntries(repository),
    reminders: new ExpoReminders(),
    purchases: purchasesFor(readRevenueCatKey()),
    getVocabularyGrowth: new GetVocabularyGrowth(repository, vocabulary, clock),
    microphonePermission: new ExpoMicrophonePermission({
      getRecordingPermissionsAsync,
      requestRecordingPermissionsAsync,
    }),
    createAudioRecorder: (native) =>
      new ExpoAudioRecorder(native, enableRecordingMode, scheduler),
  };
}
