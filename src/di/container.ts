import Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import Constants from 'expo-constants';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { AskForReview } from '../application/use-cases/AskForReview';
import { KeepAffirmation } from '../application/use-cases/KeepAffirmation';
import { CheckForUpdate } from '../application/use-cases/CheckForUpdate';
import { ConfirmEntry } from '../application/use-cases/ConfirmEntry';
import { CreateTextEntry } from '../application/use-cases/CreateTextEntry';
import { CreateVoiceEntry } from '../application/use-cases/CreateVoiceEntry';
import { TranscribeTake } from '../application/use-cases/TranscribeTake';
import { GetHomeView } from '../application/use-cases/GetHomeView';
import { FindMoodPatterns } from '../application/use-cases/FindMoodPatterns';
import { GetVocabularyGrowth } from '../application/use-cases/GetVocabularyGrowth';
import { GetWeekSummary } from '../application/use-cases/GetWeekSummary';
import { GetWeekNeighbours } from '../application/use-cases/GetWeekNeighbours';
import { GetWeekThemes } from '../application/use-cases/GetWeekThemes';
import { DeleteEntry } from '../application/use-cases/DeleteEntry';
import { KnownTopics } from '../application/use-cases/KnownTopics';
import { FindRecordedEntries } from '../application/use-cases/FindRecordedEntries';
import { FindRecording } from '../application/use-cases/FindRecording';
import { GetHistory } from '../application/use-cases/GetHistory';
import { ReviseEntry } from '../application/use-cases/ReviseEntry';
import type { EmotionVocabulary } from '../domain/entities/EmotionVocabulary';
import type { IAudioRecorder } from '../domain/ports/IAudioRecorder';
import type { IClock } from '../domain/ports/IClock';
import type { IHaptics } from '../domain/ports/IHaptics';
import type { IMicrophonePermission } from '../domain/ports/IMicrophonePermission';
import type { IScreenLock } from '../domain/ports/IScreenLock';
import type { IPurchases, PurchaseOutcome } from '../domain/ports/IPurchases';
import type { IAffirmationReminders } from '../domain/ports/IAffirmationReminders';
import type { INotificationTaps } from '../domain/ports/INotificationTaps';
import type { IReminders } from '../domain/ports/IReminders';
import type { ITranscriptionService } from '../domain/ports/ITranscriptionService';
import type { IFileSharer } from '../domain/ports/IFileSharer';
import type { ILeftoverFiles } from '../domain/ports/ILeftoverFiles';
import type { IBackupLedger } from '../domain/ports/IBackupLedger';
import { GetMonthSummary } from '../application/use-cases/GetMonthSummary';
import { GetPastMonths } from '../application/use-cases/GetPastMonths';
import { GetMonthVoice } from '../application/use-cases/GetMonthVoice';
import { ComposeMonthVoice } from '../application/use-cases/ComposeMonthVoice';
import { ImportJournal } from '../application/use-cases/ImportJournal';
import { BackUpJournal } from '../application/use-cases/BackUpJournal';
import { RestoreJournal } from '../application/use-cases/RestoreJournal';
import { CompactRecordings } from '../application/use-cases/CompactRecordings';
import { ProxyAuth, attestedFetch } from '../infrastructure/attest/ProxyAuth';
import { removeFromCache } from '../infrastructure/files/cache';
import { CacheLeftovers } from '../infrastructure/files/CacheLeftovers';
import { DocumentFilePicker } from '../infrastructure/files/DocumentFilePicker';
import { ShareSheetFileSharer } from '../infrastructure/files/ShareSheetFileSharer';
import { JournalCodec } from '../infrastructure/persistence/JournalCodec';
import { CachedNarrativeGenerator } from '../infrastructure/analysis/CachedNarrativeGenerator';
import { ClaudeNarrativeGenerator } from '../infrastructure/analysis/ClaudeNarrativeGenerator';
import { ClaudeReflectionAnalyzer } from '../infrastructure/analysis/ClaudeReflectionAnalyzer';
import { FakeNarrativeGenerator } from '../infrastructure/analysis/FakeNarrativeGenerator';
import { FakeReflectionAnalyzer } from '../infrastructure/analysis/FakeReflectionAnalyzer';
import { createEmotionVocabulary } from '../infrastructure/analysis/emotionVocabularyData';
import {
  ExpoAudioRecorder,
  type NativeRecorder,
  type ScreenAwake,
} from '../infrastructure/audio/ExpoAudioRecorder';
import { ExpoMicrophonePermission } from '../infrastructure/audio/ExpoMicrophonePermission';
import { AsyncStorageMoodEntryRepository } from '../infrastructure/persistence/AsyncStorageMoodEntryRepository';
import { AsyncStorageRevisionLog } from '../infrastructure/persistence/AsyncStorageRevisionLog';
import { FileRecordingStore } from '../infrastructure/persistence/FileRecordingStore';
import { NativeBackupArchive } from '../infrastructure/files/NativeBackupArchive';
import { detectLocale, deviceInUkraine } from '../infrastructure/settings/deviceLocale';
import { SettingsStore } from '../infrastructure/settings/SettingsStore';
import { ExpoParkedFiles } from '../infrastructure/persistence/ExpoParkedFiles';
import { FileParkedTake } from '../infrastructure/persistence/FileParkedTake';
import type { IParkedTake } from '../domain/ports/IParkedTake';
import { FeedbackUndeliveredError } from '../domain/errors/FeedbackErrors';
import { ForgetMilestone } from '../application/use-cases/ForgetMilestone';
import { GetMilestones } from '../application/use-cases/GetMilestones';
import { MarkMilestone } from '../application/use-cases/MarkMilestone';
import { AsyncStorageMilestones } from '../infrastructure/persistence/AsyncStorageMilestones';
import { AsyncStorageReviewAsks } from '../infrastructure/review/AsyncStorageReviewAsks';
import { AsyncStorageKeptAffirmations } from '../infrastructure/affirmations/AsyncStorageKeptAffirmations';
import { ExpoReviewPrompt } from '../infrastructure/review/ExpoReviewPrompt';
import { requireOptionalNativeModule } from 'expo';
import { AppleStoreListing } from '../infrastructure/store/AppleStoreListing';
import { FeedbackOutbox } from '../infrastructure/feedback/FeedbackOutbox';
import { ProxyFeedbackSender } from '../infrastructure/feedback/ProxyFeedbackSender';
import { BiometricScreenLock } from '../infrastructure/system/BiometricScreenLock';
import { ExpoHaptics } from '../infrastructure/system/ExpoHaptics';
import { IntervalScheduler } from '../infrastructure/system/IScheduler';
import { ExpoReminders } from '../infrastructure/system/ExpoReminders';
import { expoNotificationCenter } from '../infrastructure/system/expoNotificationCenter';
import { ExpoAffirmationReminders } from '../infrastructure/system/ExpoAffirmationReminders';
import { ExpoNotificationTaps } from '../infrastructure/system/ExpoNotificationTaps';
import { SystemClock } from '../infrastructure/system/SystemClock';
import { EverythingFree } from '../infrastructure/purchases/EverythingFree';
import { FakePurchases } from '../infrastructure/purchases/FakePurchases';
import { RevenueCatPurchases } from '../infrastructure/purchases/RevenueCatPurchases';
import { UnavailablePurchases } from '../infrastructure/purchases/UnavailablePurchases';
import { UuidGenerator } from '../infrastructure/system/UuidGenerator';
import { CreateUnheardEntry } from '../application/use-cases/CreateUnheardEntry';
import { HearUnheardEntries } from '../application/use-cases/HearUnheardEntries';
import type { IUnheardEntries } from '../domain/ports/IUnheardEntries';
import type { INarrativeMemory } from '../domain/ports/INarrativeMemory';
import type { INarrativeGenerator } from '../domain/ports/INarrativeGenerator';
import { AsyncStorageUnheardEntries } from '../infrastructure/persistence/AsyncStorageUnheardEntries';
import { AsyncStorageBackupLedger } from '../infrastructure/persistence/AsyncStorageBackupLedger';
import { MeasureVoices } from '../application/use-cases/MeasureVoices';
import { AsyncStorageVoiceReadings } from '../infrastructure/persistence/AsyncStorageVoiceReadings';
import { NativeSpeechTimeline } from '../infrastructure/voice/NativeSpeechTimeline';
import { NativeVoiceMontage } from '../infrastructure/voice/NativeVoiceMontage';
import { NativeVoiceAnalyzer } from '../infrastructure/voice/NativeVoiceAnalyzer';
import { DescribeVoice } from '../application/use-cases/DescribeVoice';
import { FindSpokenMoment } from '../application/use-cases/FindSpokenMoment';
import { analyzeVoice, composeMontage, montageLengths, speechSpans } from '../../modules/vidlun-voice';
import { nativeBackup } from '../../modules/vidlun-backup';
import {
  TimedMessagesClient,
  TimedReflectionAnalyzer,
  TimedTranscriptionService,
} from '../infrastructure/diagnostics/timed';
import {
  readAnthropicApiKey,
  readFakeAnalysis,
  readFakePurchaseOutcome,
  readProxyUrl,
  readRevenueCatKey,
} from './config';

export interface Container {
  readonly transcribeTake: TranscribeTake;
  /** Readies Vidlun's reading of a take while the take is still being spoken. */
  readonly warmAnalysis: () => void;
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly createTextEntry: CreateTextEntry;
  readonly confirmEntry: ConfirmEntry;
  readonly reviseEntry: ReviseEntry;
  readonly deleteEntry: DeleteEntry;
  readonly getHistory: GetHistory;
  readonly findRecording: FindRecording;
  /** Keeps the voice as AAC on the phone; run on open for anything still WAV. */
  readonly compactRecordings: CompactRecordings;
  readonly findRecordedEntries: FindRecordedEntries;
  readonly settings: SettingsStore;
  /** The take recorded before the phone could hear, if one waits. */
  readonly parkedTake: IParkedTake;
  readonly createUnheardEntry: CreateUnheardEntry;
  readonly unheardEntries: IUnheardEntries;
  readonly hearUnheardEntries: HearUnheardEntries;
  /** Measures the voice in kept recordings, for how an entry sounded. */
  readonly measureVoices: MeasureVoices;
  /** How a take or an entry sounded against the person's usual voice. */
  readonly describeVoice: DescribeVoice;
  /** Where a searched word is said in an entry's recording, estimated on the phone. */
  readonly findSpokenMoment: FindSpokenMoment;
  /** The journal's topics, for the spelling a topic written in on the card is saved with. */
  readonly knownTopics: KnownTopics;
  /** Keeps a person's note to support and mails it through the proxy when it can. */
  readonly feedback: FeedbackOutbox;
  readonly forgetAllRecordings: () => Promise<void>;
  readonly getHomeView: GetHomeView;
  readonly getWeekSummary: GetWeekSummary;
  readonly getWeekNeighbours: GetWeekNeighbours;
  readonly getMonthSummary: GetMonthSummary;
  /** The month heard in its own voice: which takes, and the file they are joined into. */
  readonly getMonthVoice: GetMonthVoice;
  readonly composeMonthVoice: ComposeMonthVoice;
  readonly getPastMonths: GetPastMonths;
  readonly getWeekThemes: GetWeekThemes;
  readonly findMoodPatterns: FindMoodPatterns;
  /** The rating request after three good entries running. */
  readonly askForReview: AskForReview;
  /** Whether the App Store sells a newer version than this one. */
  readonly checkForUpdate: CheckForUpdate;
  readonly purchases: IPurchases;
  /** Whether anything is on sale; while it is not, the profile has no subscription section. */
  readonly selling: boolean;
  readonly reminders: IReminders;
  /** The morning affirmation's notification. */
  readonly affirmationReminders: IAffirmationReminders;
  /** Taps on the affirmation's notification, which open the cards. */
  readonly notificationTaps: INotificationTaps;
  /** The affirmation picked for this day, week or month. */
  readonly keepAffirmation: KeepAffirmation;
  readonly getVocabularyGrowth: GetVocabularyGrowth;
  readonly getMilestones: GetMilestones;
  readonly markMilestone: MarkMilestone;
  readonly forgetMilestone: ForgetMilestone;
  /** The backup: one ZIP to read anywhere, with every kept voice, that Vidlun restores from. */
  readonly backUpJournal: BackUpJournal;
  readonly restoreJournal: RestoreJournal;
  readonly fileSharer: IFileSharer;
  /** Backups and picked copies an earlier session left in the cache. */
  readonly leftoverFiles: ILeftoverFiles;
  /** When the last backup was handed over, for the profile's line. */
  readonly backupLedger: IBackupLedger;
  readonly microphonePermission: IMicrophonePermission;
  /** Face ID on the journal's door, when the person turns it on in "Me". */
  readonly screenLock: IScreenLock;
  readonly haptics: IHaptics;
  readonly vocabulary: EmotionVocabulary;
  /** The screens need one too — the insights screen counts backwards from today. */
  readonly clock: IClock;
  /** Whether the phone looks to be in Ukraine, asked when a screen needs to know. */
  readonly inUkraine: () => boolean;
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
const setRecordingMode = (allowed: boolean): Promise<void> =>
  setAudioModeAsync({ allowsRecording: allowed, playsInSilentMode: true });

/** A tag of its own, so the recorder lets go of only its own hold on the screen. */
const RECORDING_KEEPS_AWAKE = 'vidlun.recording';

/*
 * Neither call can fail the take: a screen that sleeps after all is the
 * behaviour before this existed, not a broken recording.
 */
const screenAwake: ScreenAwake = {
  keepOn: () => {
    void activateKeepAwakeAsync(RECORDING_KEEPS_AWAKE).catch(() => undefined);
  },
  letSleep: () => {
    void deactivateKeepAwake(RECORDING_KEEPS_AWAKE).catch(() => undefined);
  },
};

/** Vidlun's id in the App Store, for the lookup that says which version is on sale. */
const APP_STORE_ID = '6806530807';

/*
 * Whether the store is open. Off for build 53 (owner's word, 2026-11-02):
 * every feature open to everyone, the store not asked, no subscription
 * section in the profile. On again since 2026-11-04, by the owner's word.
 */
const SELLING = true;

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
   * is not. The proxy no longer takes anything the bundle could carry: the
   * fetch underneath signs every request with a token bought from App Attest,
   * and the placeholder apiKey below is overwritten by that fetch.
   */
  const proxyUrl = readProxyUrl();
  // One attested fetch for everything that talks to the proxy, so the token
  // is bought once and renewed in one place.
  const proxyAuth = proxyUrl === null ? null : new ProxyAuth(proxyUrl);
  const proxyFetch = proxyAuth === null ? null : attestedFetch(proxyAuth);
  const anthropic = new Anthropic({
    apiKey: proxyUrl === null ? readAnthropicApiKey() : 'attested',
    baseURL: proxyUrl ?? undefined,
    fetch: proxyFetch ?? undefined,
    // React Native defines `window`, which the SDK reads as a browser.
    dangerouslyAllowBrowser: true,
    /*
     * The SDK's own default is ten minutes, which on a phone with one bar is
     * ten minutes of "composing the echo". Haiku answers the capture path in
     * two seconds when the network is there; twenty is already generous, and
     * one more attempt covers the dropped packet without doubling the wait.
     * The slower writers ask for more per call — see PATIENT_TIMEOUT_MS.
     */
    timeout: 20_000,
    maxRetries: 1,
  });

  /*
   * Stage timings in development only. M4 asks for capture-to-save under ten
   * seconds and the phone came in at thirteen after the stop, so the breakdown
   * needs to be visible while that is worked on.
   */
  const messages = __DEV__ ? new TimedMessagesClient(anthropic.messages) : anthropic.messages;
  /*
   * The pretend analysis is gated on `__DEV__` as well as on its own flag, as
   * the pretend store is: a release build cannot be talked into answering
   * someone's words with a made-up reading however the environment is set.
   */
  const reflection =
    __DEV__ && readFakeAnalysis()
      ? new FakeReflectionAnalyzer()
      : new ClaudeReflectionAnalyzer(messages, vocabulary);
  /*
   * The card shows the repaired transcript, so the two rewriters on this path
   * — the recogniser and this prompt — are indistinguishable from the outside.
   * Printing both is the only way to tell whose word a wrong word is.
   */
  const analyzer = __DEV__ ? new TimedReflectionAnalyzer(reflection) : reflection;
  const transcription = __DEV__
    ? new TimedTranscriptionService(dependencies.transcription)
    : dependencies.transcription;
  const repository = new AsyncStorageMoodEntryRepository(AsyncStorage);
  // One instance both writes the months and forgets one when an entry in it is deleted.
  const narratives: INarrativeGenerator & INarrativeMemory =
    __DEV__ && readFakeAnalysis()
      ? Object.assign(new FakeNarrativeGenerator(), { forgetMonthOf: () => Promise.resolve() })
      : new CachedNarrativeGenerator(new ClaudeNarrativeGenerator(anthropic.messages), AsyncStorage);
  // One for both kinds of notification, so each cancels only its own.
  const notificationCenter = expoNotificationCenter();
  // The version this build says it is, from app.json; the build number is not part of it.
  const installedVersion = Constants.expoConfig?.version ?? null;
  const revisionLog = new AsyncStorageRevisionLog(AsyncStorage);
  const recordings = new FileRecordingStore(nativeBackup);
  const montage = new NativeVoiceMontage({ lengths: montageLengths, compose: composeMontage });
  const backupArchive = new NativeBackupArchive(nativeBackup);
  const milestones = new AsyncStorageMilestones(AsyncStorage);
  const unheard = new AsyncStorageUnheardEntries(AsyncStorage);
  const voiceReadings = new AsyncStorageVoiceReadings(AsyncStorage);
  const voiceAnalyzer = new NativeVoiceAnalyzer(analyzeVoice);
  const describeVoice = new DescribeVoice(voiceAnalyzer, voiceReadings, recordings);

  return {
    vocabulary,
    clock,
    inUkraine: deviceInUkraine,
    haptics: new ExpoHaptics(),
    transcribeTake: new TranscribeTake(transcription),
    warmAnalysis: () => {
      void proxyAuth?.warm();
    },
    createVoiceEntry: new CreateVoiceEntry(analyzer, vocabulary, clock, idGenerator),
    createTextEntry: new CreateTextEntry(analyzer, vocabulary, clock, idGenerator),
    confirmEntry: new ConfirmEntry(repository, revisionLog, clock, recordings),
    reviseEntry: new ReviseEntry(vocabulary),
    deleteEntry: new DeleteEntry(repository, revisionLog, recordings, voiceReadings, narratives),
    getHistory: new GetHistory(repository),
    findRecording: new FindRecording(recordings),
    compactRecordings: new CompactRecordings(recordings),
    findRecordedEntries: new FindRecordedEntries(recordings),
    settings: new SettingsStore(AsyncStorage, detectLocale),
    parkedTake: new FileParkedTake(AsyncStorage, new ExpoParkedFiles()),
    createUnheardEntry: new CreateUnheardEntry(clock, idGenerator),
    unheardEntries: unheard,
    hearUnheardEntries: new HearUnheardEntries(unheard, repository, analyzer, vocabulary),
    measureVoices: new MeasureVoices(recordings, voiceReadings, voiceAnalyzer),
    describeVoice,
    findSpokenMoment: new FindSpokenMoment(new NativeSpeechTimeline(speechSpans)),
    knownTopics: new KnownTopics(repository),
    /*
     * Through an outbox, so the sheet closes on the tap and a note the
     * network refused goes at the next chance. Without a proxy there is no
     * way to mail anything: the sender refuses out loud and the note waits
     * in the outbox rather than silently going nowhere.
     */
    feedback: new FeedbackOutbox(
      AsyncStorage,
      proxyUrl === null || proxyFetch === null
        ? { send: (): Promise<void> => Promise.reject(new FeedbackUndeliveredError(0)) }
        : new ProxyFeedbackSender(proxyUrl, proxyFetch),
      idGenerator,
      clock,
    ),
    // Everything up to now, which is everything: turning the setting off is a
    // request to be rid of the voice, not only to stop adding to it.
    /*
     * Turning off keeping the voice takes what was measured in it too: the
     * numbers are not the sound, but someone who asked for their voice to
     * be gone should not find it described anywhere.
     */
    forgetAllRecordings: async () => {
      await recordings.discardBefore(clock.now());
      await voiceReadings.clear();
    },
    getHomeView: new GetHomeView(repository, clock, recordings),
    getMilestones: new GetMilestones(milestones),
    markMilestone: new MarkMilestone(milestones, clock, idGenerator),
    forgetMilestone: new ForgetMilestone(milestones),
    getWeekSummary: new GetWeekSummary(repository, clock),
    getWeekNeighbours: new GetWeekNeighbours(repository, clock),
    getMonthSummary: new GetMonthSummary(repository, narratives, clock, describeVoice),
    getMonthVoice: new GetMonthVoice(repository, recordings, montage),
    composeMonthVoice: new ComposeMonthVoice(montage),
    getPastMonths: new GetPastMonths(repository, clock),
    getWeekThemes: new GetWeekThemes(repository),
    findMoodPatterns: new FindMoodPatterns(repository),
    askForReview: new AskForReview(
      repository,
      new AsyncStorageReviewAsks(AsyncStorage),
      new ExpoReviewPrompt((name) => requireOptionalNativeModule(name) !== null),
      installedVersion ?? 'unknown',
    ),
    checkForUpdate: new CheckForUpdate(new AppleStoreListing(APP_STORE_ID), installedVersion),
    reminders: new ExpoReminders(notificationCenter),
    affirmationReminders: new ExpoAffirmationReminders(notificationCenter),
    notificationTaps: new ExpoNotificationTaps(),
    keepAffirmation: new KeepAffirmation(new AsyncStorageKeptAffirmations(AsyncStorage), clock),
    purchases: SELLING ? purchasesFor(readRevenueCatKey()) : new EverythingFree(),
    selling: SELLING,
    getVocabularyGrowth: new GetVocabularyGrowth(repository, clock),
    backUpJournal: new BackUpJournal(repository, new JournalCodec(), recordings, backupArchive, clock),
    restoreJournal: new RestoreJournal(
      new ImportJournal(repository, new JournalCodec()),
      repository,
      recordings,
      backupArchive,
      new DocumentFilePicker(),
    ),
    fileSharer: new ShareSheetFileSharer(),
    leftoverFiles: new CacheLeftovers(),
    backupLedger: new AsyncStorageBackupLedger(AsyncStorage),
    microphonePermission: new ExpoMicrophonePermission({
      getRecordingPermissionsAsync,
      requestRecordingPermissionsAsync,
    }),
    screenLock: new BiometricScreenLock(),
    createAudioRecorder: (native) =>
      new ExpoAudioRecorder(native, setRecordingMode, scheduler, screenAwake, removeFromCache),
  };
}
