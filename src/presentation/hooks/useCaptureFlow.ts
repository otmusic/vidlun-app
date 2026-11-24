import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConfirmEntry } from '@/application/use-cases/ConfirmEntry';
import type { CreateTextEntry } from '@/application/use-cases/CreateTextEntry';
import type { CreateVoiceEntry } from '@/application/use-cases/CreateVoiceEntry';
import type { Reading } from '@/application/use-cases/draftFromProposal';
import type { Spoken, TranscribeTake } from '@/application/use-cases/TranscribeTake';
import type { GetHomeView, HomeView } from '@/application/use-cases/GetHomeView';
import type {
  GetVocabularyGrowth,
  VocabularyGrowth,
} from '@/application/use-cases/GetVocabularyGrowth';
import type { GetWeekSummary } from '@/application/use-cases/GetWeekSummary';
import type { GetWeekNeighbours } from '@/application/use-cases/GetWeekNeighbours';
import type { FindMoodPatterns } from '@/application/use-cases/FindMoodPatterns';
import type { GetWeekThemes } from '@/application/use-cases/GetWeekThemes';
import type { DeleteEntry, DeletedEntry } from '@/application/use-cases/DeleteEntry';
import type { FindRecordedEntries } from '@/application/use-cases/FindRecordedEntries';
import type { FindRecording } from '@/application/use-cases/FindRecording';
import type { CompactRecordings } from '@/application/use-cases/CompactRecordings';
import type { GetHistory, HistoryDay } from '@/application/use-cases/GetHistory';
import { mayWriteAnother } from '@/domain/entities/Entitlement';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { type CardTopics, keptTopics, withTopicAdded, withTopicToggled } from '@/domain/entities/Topic';
import type { LegalDocumentKind } from '@/i18n/legal';
import type { GetMonthSummary, MonthSummary } from '@/application/use-cases/GetMonthSummary';
import type { ComposeMonthVoice, PlayableMonth } from '@/application/use-cases/ComposeMonthVoice';
import type { GetMonthVoice } from '@/application/use-cases/GetMonthVoice';
import type { MonthVoice, MonthVoiceMode } from '@/domain/entities/MonthVoice';
import type { GetPastMonths, PastMonth } from '@/application/use-cases/GetPastMonths';
import type { StatsView } from '@/presentation/screens/StatsScreen';
import type { JournalFocus } from '@/presentation/screens/journalFilter';
import { entryDays, type EntryDays } from '@/presentation/components/entryDays';
import { NothingWasSaidError } from '@/domain/errors/MoodEntryErrors';
import { RecordingCancelledError } from '@/domain/errors/RecordingErrors';
import { Confidence } from '@/domain/value-objects/Confidence';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import type { IAudioRecorder } from '@/domain/ports/IAudioRecorder';
import type { IClock } from '@/domain/ports/IClock';
import type { IPurchases, Plan, PurchaseOutcome } from '@/domain/ports/IPurchases';
import type { IHaptics } from '@/domain/ports/IHaptics';
import type { Milestone } from '@/domain/entities/Milestone';
import type { IParkedTake, ParkedTake } from '@/domain/ports/IParkedTake';
import type { IUnheardEntries } from '@/domain/ports/IUnheardEntries';
import type { CreateUnheardEntry } from '@/application/use-cases/CreateUnheardEntry';
import type { HearUnheardEntries } from '@/application/use-cases/HearUnheardEntries';
import type { MeasureVoices } from '@/application/use-cases/MeasureVoices';
import type { DescribeVoice } from '@/application/use-cases/DescribeVoice';
import type { FindSpokenMoment } from '@/application/use-cases/FindSpokenMoment';
import type { KnownTopics } from '@/application/use-cases/KnownTopics';
import { SearchQuery } from '@/domain/value-objects/SearchQuery';
import type { VoiceCue, VoiceHeard } from '@/domain/value-objects/VoiceCue';
import type { AskForReview } from '@/application/use-cases/AskForReview';
import type { CheckForUpdate } from '@/application/use-cases/CheckForUpdate';
import type { KeepAffirmation } from '@/application/use-cases/KeepAffirmation';
import type { AffirmationChoice, KeptAffirmation } from '@/domain/entities/KeptAffirmation';
import type { AffirmationFrequency } from '@/domain/ports/IAffirmationReminders';
import type { StoreRelease } from '@/domain/ports/IStoreListing';
import type { ForgetMilestone } from '@/application/use-cases/ForgetMilestone';
import type { GetMilestones } from '@/application/use-cases/GetMilestones';
import type { MarkMilestone } from '@/application/use-cases/MarkMilestone';
import type { MilestoneSheetState } from '../components/MilestoneSheet';
import type { IMicrophonePermission, PermissionStatus } from '@/domain/ports/IMicrophonePermission';

/**
 * The card's steps (owner's word, 2026-11-23): the words and their topics,
 * then what the person feels, then the mood, which saves. Choosing together
 * is a sheet over the feelings step, not a screen of its own (2026-11-24).
 */
export type CardStep = 'words' | 'feelings' | 'mood';

/**
 * The card, asking before it answers. One stage rather than one per step: the
 * steps, the question and the hold are the same card in different states. The
 * card itself goes up once Vidlun's reading is in (owner's word, 2026-10-01);
 * until then the stage is drawn as the processing screen.
 */
export interface TurnStage {
  readonly kind: 'turn';
  /** Which of the card's steps is on screen. */
  readonly step: CardStep;
  readonly spoken: Spoken;
  /** What the person has named so far. Empty is an answer, not a blank. */
  readonly chosen: readonly string[];
  /** Null until the analysis lands behind the question. */
  readonly draft: MoodEntry | null;
  /**
   * The other words the reading put beside what it heard, for the card to
   * offer (owner's word, 2026-10-23). Empty until it lands, and when it
   * could not listen.
   */
  readonly nearby: readonly string[];
  /** True once they have answered and are waiting on the analysis. */
  readonly holding: boolean;
  /**
   * True when Vidlun could not listen — no network, or none fast enough.
   * The draft is then the words alone, and the person's answer is the
   * whole entry; Vidlun's comes later, through HearUnheardEntries.
   */
  readonly unheard: boolean;
  /**
   * True once "choose" in the choosing-together sheet put Vidlun's words on
   * the card (owner's word, 2026-11-24): the way to them is gone from the
   * card then, the words being in its row.
   */
  readonly together: boolean;
  /**
   * The mood set on the card's scale (owner's word, 2026-10-01). Null until
   * the scale is touched, and Vidlun's reading stands until then.
   */
  readonly mood: number | null;
  /**
   * Topics the person took off the card (owner's word, 2026-10-01). The
   * reading keeps all of them, as what Vidlun heard; the entry is saved
   * without these. A correction keeps them off, like the named words.
   */
  readonly droppedTopics: readonly string[];
  /**
   * Topics the person wrote in where Vidlun missed one (owner's word,
   * 2026-11-23), saved after Vidlun's. Only here, before saving: a kept
   * entry's topics do not change.
   */
  readonly addedTopics: readonly string[];
  /**
   * What the person had named before choosing together showed them Vidlun's
   * words. Null until its sheet first opened (owner's word, 2026-11-24): from
   * then on Vidlun's words have been seen, whatever was taken from them, and
   * this stays the unaided answer `selfEmotionIds` is written from.
   */
  readonly namedAlone: readonly string[] | null;
}

/**
 * A month written back: the one just ended behind home's card, or any
 * earlier one from the list of past months (owner's word, 2026-10-06).
 * Null while its shape is read; the prose is written in after. `from` is
 * where its back arrow goes.
 */
export interface MonthStage {
  readonly kind: 'month';
  readonly month: MonthSummary | null;
  readonly from: 'idle' | 'months';
  /**
   * The month heard in its own voice (owner's word, 2026-11-23); null while
   * it is gathered, and when no entry of the month kept a voice.
   */
  readonly voice: MonthVoice | null;
}

export type CaptureStage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'recording' }
  | { readonly kind: 'writing' }
  | { readonly kind: 'processing' }
  /**
   * A take recorded before the phone could hear, kept until it can. The
   * screen shows the download and lets the person leave; the take waits for
   * them on home either way.
   */
  | { readonly kind: 'parked' }
  | TurnStage
  | { readonly kind: 'reflecting'; readonly proposed: MoodEntry; readonly draft: MoodEntry }
  /**
   * The answer is in and the entry is being written — no card in between
   * (owner's word, 2026-09-30). A stage rather than a call so the analysis
   * landing on a card someone already answered can end in a save too.
   */
  | {
      readonly kind: 'saving';
      readonly proposed: MoodEntry;
      readonly draft: MoodEntry;
      /** True when words of Vidlun's, chosen together, were taken off: the disagreement log. */
      readonly declined: boolean;
    }
  | {
      readonly kind: 'saved';
      readonly streakDays: number;
      /**
       * True when the entry sounded overwhelmed — distress, never crisis —
       * and a minute of grounding is offered after "saved", on a page of its
       * own (owner's word, 2026-10-06). The drawing gates it the same way:
       * `hard && !crisis`.
       */
      readonly offersGrounding: boolean;
      /** True when the entry was saved without Vidlun's answer, which is still owed. */
      readonly unheard: boolean;
    }
  /** The grounding exercise. Keeps nothing, and must never learn to. */
  | {
      readonly kind: 'grounding';
      /** Offered after a hard entry, or opened from "Me" (owner's word, 2026-10-06). */
      readonly from: 'saved' | 'settings';
    }
  | { readonly kind: 'history' }
  | { readonly kind: 'settings' }
  /**
   * The five affirmation cards, opened from their morning notification; or,
   * when one was already picked for this period, that one again.
   */
  | {
      readonly kind: 'affirmation';
      readonly kept: KeptAffirmation | null;
    }
  /** The one thing sold, and what the store said about buying it. */
  | {
      readonly kind: 'subscription';
      /**
       * Null while the store has not answered. An empty list is an answer —
       * nothing to sell — and the two must never look alike: a wait drawn as
       * "the store isn't responding" is a false error on the page that sells
       * the app.
       */
      readonly plans: readonly Plan[] | null;
      /** Which ask of the store the page waits on; a late answer to an earlier one is dropped. */
      readonly ask: number;
      readonly outcome: PurchaseOutcome | null;
    }
  /**
   * The terms or the privacy policy, opened from the paywall and going back to
   * it. Reachable from nowhere else, which is why leaving is `openSubscription`
   * rather than a remembered origin.
   */
  | { readonly kind: 'legal'; readonly doc: LegalDocumentKind }
  /**
   * The insights screen. `weeksBack` lives on the stage rather than beside it
   * so that leaving and coming back starts at this week again — a screen that
   * remembers you were reading June is a screen you have to navigate out of.
   */
  | { readonly kind: 'stats'; readonly weeksBack: number; readonly view: StatsView | null }
  | MonthStage
  /** Every past month with something to read, behind the statistics screen. Null while counted. */
  | { readonly kind: 'months'; readonly months: readonly PastMonth[] | null }
  /** The other half of the insights screen, and its own screen in the drawing. */
  | {
      readonly kind: 'vocabulary';
      readonly growth: VocabularyGrowth | null;
      /** The oldest entry there is, so the calendar offers nothing emptier. */
      readonly earliest: Date | null;
      /** Local midnights of the days with entries, dotted on the calendar. */
      readonly entryDays: EntryDays;
    }
  | {
      readonly kind: 'detail';
      /**
       * Where this card was opened from, so closing or deleting it goes back
       * there. Without it every card returns to history, including the ones
       * opened from home.
       */
      readonly from: 'idle' | 'history';
      /**
       * The month it was opened from, as it stood, when it was opened from
       * the month heard in its own voice: closing goes back there instead.
       */
      readonly backTo: MonthStage | null;
      readonly entry: MoodEntry;
      /** Null while it is being looked up, and if there is none. */
      readonly recordingUri: string | null;
      /** How the voice sounded against the usual one; null while it is being worked out. */
      readonly voice: VoiceHeard | null;
      /** What the journal's search held when the entry was opened from it; null otherwise. */
      readonly found: string | null;
      /**
       * Where in the recording the searched word is said, give or take, for
       * the player to start from; null when there is no search or no telling.
       */
      readonly playFromMs: number | null;
    };

/**
 * A line laid over whatever is on screen, and gone on its own. A failure used
 * to be a screen of its own whose only way out went home, and the entry went
 * with it; now the screen that was there stays, with its work, and the line
 * says what did not go through. `id` tells two identical notices apart, so
 * the same failure twice still shows twice.
 */
export type Notice = NoticeBody & { readonly id: number };

export type NoticeBody =
  /** Something did not go through; `message` is the layer below's own words. */
  | { readonly kind: 'failed'; readonly message: string }
  /** Vidlun could not listen: the entry stays the person's, the answer comes later. */
  | { readonly kind: 'unheard' }
  /** The take held no words: nothing to read, and saying so plainly beats an error. */
  | { readonly kind: 'silent' };

export interface CaptureDependencies {
  readonly recorder: IAudioRecorder;
  readonly haptics: IHaptics;
  readonly transcribeTake: TranscribeTake;
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly createTextEntry: CreateTextEntry;
  readonly confirmEntry: ConfirmEntry;
  readonly deleteEntry: DeleteEntry;
  readonly getHistory: GetHistory;
  readonly findRecording: FindRecording;
  /** Keeps the voice as AAC on the phone (owner's word, 2026-11-18). */
  readonly compactRecordings: CompactRecordings;
  readonly findRecordedEntries: FindRecordedEntries;
  /** False stops a confirmed take from being kept at all. */
  readonly keepRecordings: boolean;
  /**
   * How often the affirmation comes now, which is the period a pick is kept
   * for — monthly without a subscription. Null until the store has said
   * whether there is one, and the kept one is not read until then.
   */
  readonly affirmationFrequency: AffirmationFrequency | null;
  readonly parkedTake: IParkedTake;
  /** The draft for words Vidlun could not listen to; the person's answer still goes in. */
  readonly createUnheardEntry: CreateUnheardEntry;
  /** Where such entries wait to be heard. */
  readonly unheardEntries: IUnheardEntries;
  readonly hearUnheardEntries: HearUnheardEntries;
  readonly measureVoices: MeasureVoices;
  readonly describeVoice: DescribeVoice;
  readonly findSpokenMoment: FindSpokenMoment;
  /** The journal's topics, for the spelling a topic written in on the card is saved with. */
  readonly knownTopics: KnownTopics;
  readonly microphonePermission: IMicrophonePermission;
  readonly getHomeView: GetHomeView;
  readonly getWeekSummary: GetWeekSummary;
  readonly getWeekNeighbours: GetWeekNeighbours;
  readonly getMonthSummary: GetMonthSummary;
  readonly getMonthVoice: GetMonthVoice;
  readonly composeMonthVoice: ComposeMonthVoice;
  readonly getPastMonths: GetPastMonths;
  readonly getWeekThemes: GetWeekThemes;
  readonly findMoodPatterns: FindMoodPatterns;
  readonly getVocabularyGrowth: GetVocabularyGrowth;
  readonly getMilestones: GetMilestones;
  readonly markMilestone: MarkMilestone;
  readonly forgetMilestone: ForgetMilestone;
  /** True while the free week runs. The chart and the themes never wait on it. */
  readonly hasNarrativeAccess: boolean;
  /** Injected for the same reason the use cases take one: a test cannot wait a week. */
  readonly clock: IClock;
  readonly purchases: IPurchases;
  /** Told when the store says something that changes what may be read. */
  readonly onEntitlementChanged: () => void;
  /** The rating request, put to the person on home after three good entries running. */
  readonly askForReview: AskForReview;
  readonly checkForUpdate: CheckForUpdate;
  readonly keepAffirmation: KeepAffirmation;
}

export interface CaptureFlow {
  readonly stage: CaptureStage;
  /** The line over the screen, if one is showing. */
  readonly notice: Notice | null;
  readonly dismissNotice: () => void;
  readonly home: HomeView | null;
  /** Re-reads the home view; the splash's retry when opening the journal hangs. */
  readonly reloadHome: () => void;
  /** Listens, late, to entries saved without Vidlun's answer. App calls it on coming to the front. */
  readonly hearUnheard: () => void;
  /** Measures the voice in recordings that have no reading yet. App calls it on coming to the front. */
  readonly measureVoices: () => void;
  /** The month being offered on home's first-days card, or null off-season. */
  readonly monthCard: Date | null;
  /** A newer version on sale in the App Store, for the line on top of home; null otherwise. */
  readonly update: StoreRelease | null;
  /** Asks the store again, at most every few hours. App calls it on coming to the front. */
  readonly checkForUpdate: () => void;
  readonly startRecording: () => void;
  readonly stopRecording: () => void;
  /** Holds the take while the person is asked whether to leave it. */
  readonly pauseRecording: () => void;
  /** Goes on with the held take: their answer was to stay. */
  readonly resumeRecording: () => void;
  /** How loud the voice is right now, 0 to 1, for the recording screen's bars. */
  readonly voiceLevel: () => number;
  /** Whether a call, Siri or an alarm has taken the microphone from the take. */
  readonly recordingInterrupted: () => boolean;
  /** The take waiting for the model, if any — shown on home until it is read. */
  readonly parked: ParkedTake | null;
  /**
   * Where the microphone stands with the system. `denied` is the one state
   * a tap cannot fix from inside the app, so home says so instead of trying.
   */
  readonly micStatus: PermissionStatus;
  /** Reads the waiting take now that the phone can hear. */
  readonly continueParked: () => void;
  /** Every milestone, oldest first; the strip, the chart and the journal mark from it. */
  readonly milestones: readonly Milestone[];
  readonly milestoneSheet: MilestoneSheetState | null;
  /** Opens the sheet: for today when called bare, for the given one to rename or delete. */
  readonly openMilestone: (milestone?: Milestone) => void;
  readonly closeMilestone: () => void;
  readonly saveMilestone: (label: string) => void;
  readonly deleteMilestone: () => void;
  readonly cancel: () => void;
  readonly startWriting: () => void;
  /** Opens the text screen aimed at yesterday evening — the missed day's door. */
  readonly startYesterday: () => void;
  readonly submitText: (text: string) => void;
  /** Adds or removes one of the person's own words while the card is asking. */
  readonly toggleOwnWord: (id: string) => void;
  /** Adds a word typed on the card; never takes one away, so a repeat is harmless. */
  readonly addOwnWord: (id: string) => void;
  /** Sets the mood on the card's scale, in place of Vidlun's reading. */
  readonly setMood: (value: number) => void;
  /** Takes one of Vidlun's topics off the card or puts it back; takes one of the person's own away. */
  readonly toggleTopic: (tag: string) => void;
  /** Writes a topic of the person's own onto the card. */
  readonly addTopic: (typed: string) => void;
  /** Reads the journal's topics for the line that has just opened, for the spelling a typed one is saved with. */
  readonly readKnownTopics: () => void;
  /** From the words to the feelings. */
  readonly toFeelings: () => void;
  /** From the feelings to the mood. */
  readonly toMood: () => void;
  /** One step back: the mood to the feelings, the feelings to the words. */
  readonly stepBack: () => void;
  /** The take behind the card, to play back on its first step; null for typed words and once it is gone. */
  readonly take: string | null;
  /** "Save" on the mood: saves what was named, or waits for the reading to land. */
  readonly answer: () => void;
  /** "Choose together" opened its sheet: what was named so far is the unaided answer from now on. */
  readonly openTogether: () => void;
  /** "Choose" in that sheet: these of Vidlun's words join the ones on the card. */
  readonly chooseTogether: (ids: readonly string[]) => void;
  /**
   * The transcript, fixed by the one person who knows what was said. Throws
   * the mishearing's analysis away and reads the corrected words instead.
   */
  readonly correctWording: (text: string) => void;
  /**
   * Throws away the entry on the card before it was ever saved: its words,
   * its take and Vidlun's reading of it, landed or still on the way. Home.
   */
  readonly discardEntry: () => void;
  readonly confirm: () => void;
  readonly backHome: () => void;
  /** The saved screen's way out: home, and the rating request when it is due. */
  readonly leaveSaved: () => void;
  /**
   * The affirmation notification was tapped. Opens the cards at once from
   * somewhere quiet, and on the way home from the middle of an entry.
   */
  readonly openAffirmation: () => void;
  /** The journal's button, before this period's is picked: the five, and back to the journal after. */
  readonly pickAffirmation: () => void;
  /** The page's X and "Done": back to the journal when it was opened there, home otherwise. */
  readonly closeAffirmation: () => void;
  /** Keeps the one just picked for the period it was picked in. */
  readonly keepAffirmation: (choice: AffirmationChoice, frequency: AffirmationFrequency) => void;
  /**
   * The affirmation kept for this period, for the buttons on home and in the
   * journal; null when none is, undefined until the store has answered.
   */
  readonly keptAffirmation: KeptAffirmation | null | undefined;
  /** Deletes at once; the undo line offers it back for a few seconds. */
  readonly deleteEntry: (id: string) => void;
  /**
   * The deletion that can still be undone, by a number that changes with
   * each one so the line starts its count afresh; null when there is none.
   */
  readonly undoable: number | null;
  /** "Undo": the entry comes back with everything it had. */
  readonly undoDelete: () => void;
  /** The seconds ran out or the line was dismissed: the deletion is final. */
  readonly settleDelete: () => void;
  readonly history: readonly HistoryDay[] | null;
  /** The entries that still have their audio; null until looked up. */
  readonly recorded: ReadonlySet<string> | null;
  readonly openHistory: () => void;
  /**
   * The emotions the journal is narrowed to; empty shows every entry. Kept
   * while an entry is opened from the list and closed again, cleared when the
   * journal is opened from the bar (owner's word, 2026-10-13).
   */
  readonly journalFilter: readonly string[];
  /** What is typed into the journal's search; empty shows every entry. */
  readonly journalQuery: string;
  readonly searchJournal: (typed: string) => void;
  readonly filterJournal: (emotionIds: readonly string[]) => void;
  /**
   * The handful of entries the journal was opened on from a pattern, or null.
   * Cleared with the bar's journal tab, with its X, and by the emotion filter.
   */
  readonly journalFocus: JournalFocus | null;
  readonly openJournalFocus: (focus: JournalFocus) => void;
  readonly clearJournalFocus: () => void;
  /** Leaves an open card for wherever it was opened from. */
  readonly closeEntry: () => void;
  /** `found` is the journal's search when the entry is opened from its results. */
  readonly openEntry: (entry: MoodEntry, found?: string) => void;
  readonly openSettings: () => void;
  readonly openSubscription: () => void;
  readonly openLegal: (doc: LegalDocumentKind) => void;
  /** The grounding offer, after an entry that sounded overwhelmed. */
  readonly startGrounding: () => void;
  /** The exercise opened from "Me": no offer first, the person asked for it. */
  readonly openGrounding: () => void;
  /** The exercise's X: back to "Me" when it was opened there, home otherwise. */
  readonly leaveGrounding: () => void;
  /** A tick for each thing noticed in the exercise, felt rather than seen. */
  readonly noticed: () => void;
  readonly subscribe: (planId: string) => void;
  readonly restorePurchase: () => void;
  /** Apple's sheet for an offer code; what it grants arrives as a status change. */
  readonly redeemCode: () => void;
  readonly dismissPurchaseOutcome: () => void;
  readonly openStats: () => void;
  /** Home's month card: the month written back, or the plans without access to it. */
  readonly openMonth: () => void;
  /** Every past month, from the statistics screen. */
  readonly openMonths: () => void;
  /** One month from that list: its page, or the plans without access to it. */
  readonly openMonthOf: (monthStart: Date) => void;
  /** The month page's back: to the list when it was opened there, home otherwise. */
  readonly closeMonth: () => void;
  /** The month's takes joined into one file to play, in a mode. */
  readonly composeMonthVoice: (voice: MonthVoice, mode: MonthVoiceMode) => Promise<PlayableMonth | null>;
  readonly openVocabulary: () => void;
  /** Re-counts the vocabulary over a period the person picked. */
  readonly showPeriod: (period: { readonly from: Date; readonly to: Date }) => void;
  /** One week further back, and one week forward again. Never past this week. */
  readonly showEarlierWeek: () => void;
  readonly showLaterWeek: () => void;
}

/** Home's last entry, one for everyone (owner's word, 2026-11-17; two until then). */
const RECENT_LIMIT = 1;

/** How long one look at the App Store answers for; coming back sooner does not ask again. */
const UPDATE_CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** A beat after home is back, so the rating sheet lands on home and not on the way to it. */
const REVIEW_AFTER_HOME_MS = 700;

/**
 * How long the analysis waits for the take's voice. Measuring takes a few
 * hundredths of a second and runs beside the recognition, which takes far
 * longer, so this is only ever reached when something is wrong.
 */
const VOICE_PATIENCE_MS = 1_500;

/**
 * The stages an entry is being made in. A tap on the affirmation's
 * notification must not throw a take or an answered card away, so from
 * these it waits for home instead.
 */
const MAKING_AN_ENTRY: ReadonlySet<CaptureStage['kind']> = new Set([
  'recording',
  'writing',
  'processing',
  'turn',
  'reflecting',
  'saving',
  'saved',
  'grounding',
]);

/**
 * The capture path as one state machine. Every transition here is on the ten
 * second budget, so nothing in it asks the user a question it could answer.
 */
/**
 * What a failure says on screen. A take with no words in it is not something
 * that broke — the person needs to hear it in the app's words and try again,
 * not read the error's English line under a Ukrainian title (owner's word,
 * 2026-11-02). Everything else keeps the layer below's own message.
 */
export function noticeFor(error: unknown): NoticeBody {
  return error instanceof NothingWasSaidError
    ? { kind: 'silent' }
    : { kind: 'failed', message: describe(error) };
}

/**
 * Native modules reject with plain objects as often as with Errors, and
 * `String({})` turns those into "[object Object]" — the one message that says
 * nothing at all. Whatever the layer below throws, something readable has to
 * survive it.
 */
function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const message: unknown = (error as { message?: unknown }).message;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}

/**
 * The words on the card once choosing together has added Vidlun's: the
 * person's own first, then Vidlun's — six at most, the entry's ceiling.
 */
function wordsChosenTogether(
  chosen: readonly string[],
  heard: readonly string[],
): readonly string[] {
  return [...chosen, ...heard.filter((id) => !chosen.includes(id))].slice(
    0,
    MoodEntry.MAX_EMOTIONS,
  );
}

/**
 * Whether the person left out any of Vidlun's words once they had seen them.
 * Choosing together offers them already chosen, so leaving one out is an act
 * rather than an untouched screen — the refusal the disagreement log is for.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function declinedVidlunsWords(proposed: MoodEntry, draft: MoodEntry): boolean {
  const startedWith = wordsChosenTogether(draft.selfEmotionIds, proposed.emotionIds);

  return proposed.emotionIds.some(
    (id) => startedWith.includes(id) && !draft.emotionIds.includes(id),
  );
}

/** The card's topics as the domain reads them; Vidlun's are empty until the reading lands. */
function topicsOf(card: TurnStage): CardTopics {
  return {
    proposed: card.draft?.contextTags ?? [],
    dropped: card.droppedTopics,
    added: card.addedTopics,
  };
}

/**
 * What the card holds once the answering is over: the entry, saved as it
 * stands, with no card in between (owner's word, 2026-09-30) — a hard entry
 * too, whose flag still brings the grounding offer on the saved screen. What
 * Vidlun heard is not thrown away; it stays on the draft as the proposal, for
 * the revision log and the granularity metric.
 *
 * No words at all is an answer as well (§6): one given with Vidlun's words in
 * sight, or one where Vidlun heard none either (owner's word, 2026-11-24).
 */
function cardAfterAnswer(card: TurnStage, proposed: MoodEntry): CaptureStage {
  const { chosen } = card;
  const mood = card.mood === null ? proposed.mood : MoodScore.of(card.mood);
  const contextTags = keptTopics({
    proposed: proposed.contextTags,
    dropped: card.droppedTopics,
    added: card.addedTopics,
  });
  // Once Vidlun's words were seen, the unaided answer is what was named before.
  const sawVidlunsWords = card.namedAlone !== null;
  const draft = MoodEntry.create({
    ...proposed.toProps(),
    selfEmotionIds: card.namedAlone ?? chosen,
    emotionIds: chosen,
    mood,
    contextTags,
  });

  return {
    kind: 'saving',
    proposed,
    draft,
    declined: sawVidlunsWords && declinedVidlunsWords(proposed, draft),
  };
}

/**
 * Where "save" on the mood step goes: on, once the reading is in, or holding
 * for it, and on the moment it lands.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenAnswered(current: CaptureStage): CaptureStage {
  if (current.kind !== 'turn') {
    return current;
  }

  return current.draft === null
    ? { ...current, holding: true }
    : cardAfterAnswer(current, current.draft);
}

/**
 * "Choose together" opened its sheet, and Vidlun's words are in sight (owner's
 * word, 2026-11-24): what was named until now is the unaided answer, and stays
 * it however often the sheet opens again.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenTogetherOpened(current: CaptureStage): CaptureStage {
  if (current.kind !== 'turn' || current.draft === null || current.namedAlone !== null) {
    return current;
  }

  return { ...current, namedAlone: current.chosen };
}

/**
 * "Choose" in the choosing-together sheet: the words of Vidlun's left chosen
 * there join the card's own row, after the person's, and the way to them is
 * gone (owner's word, 2026-11-24). Nothing already on the card is taken off.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenChosenTogether(current: CaptureStage, picked: readonly string[]): CaptureStage {
  if (current.kind !== 'turn' || current.draft === null) {
    return current;
  }

  return {
    ...current,
    chosen: wordsChosenTogether(current.chosen, picked),
    namedAlone: current.namedAlone ?? current.chosen,
    together: true,
  };
}

/**
 * The card moved to one of its steps, by its buttons and its back arrows.
 * Anything else is left as it is: a tap that lands after the card is gone.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenStepped(current: CaptureStage, step: CardStep): CaptureStage {
  return current.kind === 'turn' ? { ...current, step } : current;
}

/**
 * Where the back arrow goes from a step: the mood to the feelings, the
 * feelings to the words. The words are the first step and stay put.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenSteppedBack(current: CaptureStage): CaptureStage {
  if (current.kind !== 'turn' || current.step === 'words') {
    return current;
  }

  return whenStepped(current, current.step === 'mood' ? 'feelings' : 'words');
}

/** Any day inside the week `weeksBack` weeks before the one holding `from`. */
function weeksAgo(from: Date, weeksBack: number): Date {
  const shifted = new Date(from.getTime());

  shifted.setDate(shifted.getDate() - weeksBack * 7);

  return shifted;
}

/**
 * Where the analysis goes when it arrives, which is the one transition §3b's
 * leak rule lives or dies on.
 *
 * Exported for the test rather than for a caller. Nothing of the answer may be
 * on screen before the answer is given, and that defect would never be noticed
 * in use — the card would simply look a little more helpful than it should.
 */
export function whenAnalysisLands(
  current: CaptureStage,
  draft: MoodEntry,
  /** The transcript this analysis was started for; absent means any. */
  forText?: string,
  /** The other words the reading put beside it, for the card to offer. */
  nearby: readonly string[] = [],
): CaptureStage {
  if (current.kind !== 'turn') {
    return current;
  }

  /*
   * An analysis of wording the person has since corrected. Dropping it is
   * the whole correction: the corrected take's own analysis is already
   * running, and letting this one land would put emotions read off the
   * mishearing onto words nobody said.
   */
  if (forText !== undefined && forText !== current.spoken.text) {
    return current;
  }

  /*
   * Held, not shown whole. The draft is carried on the stage because the
   * comparison needs it the instant the person answers. The card's steps are given
   * only what the owner put on the card — the words near the reading, its
   * mood and its topics (2026-09-30, 2026-10-01) — and never the observation,
   * so what the card can display and what the stage knows stay two sets.
   */
  const card = { ...current, draft, nearby };

  return current.holding ? cardAfterAnswer(card, draft) : card;
}

/**
 * Where the failure goes when the analysis does not arrive: onto the card it
 * was started for, as the words alone, for the person's answer to be the
 * whole entry. Any other card, or none, is left as it is — the failure
 * belongs to a question nobody is looking at any more.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
/**
 * Where a tap on the mood scale goes: the question card, which holds it until
 * the answer. Choosing together had a scale of its own from 2026-10-29 until
 * its "save" went back to the card (owner's word, 2026-11-12); the card's
 * scale is the one the entry is saved with.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenMoodSet(current: CaptureStage, value: number): CaptureStage {
  return current.kind === 'turn' ? { ...current, mood: value } : current;
}

/**
 * The subscription page as it opens, and as "try again" puts it back: waiting
 * on the store, with nothing priced and nothing said about a purchase.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenPlansAsked(ask: number): CaptureStage {
  return { kind: 'subscription', plans: null, ask, outcome: null };
}

/**
 * Where the store's answer goes: onto the page that asked for it, and only if
 * no newer ask has replaced it since. Leaving and coming back, or "try
 * again", asks anew; an earlier answer landing after that — an empty one
 * especially — would call a wait that is still running a quiet store.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
export function whenPlansArrive(
  current: CaptureStage,
  plans: readonly Plan[],
  ask: number,
): CaptureStage {
  return current.kind === 'subscription' && current.ask === ask ? { ...current, plans } : current;
}

export function whenAnalysisFails(
  current: CaptureStage,
  draft: MoodEntry,
  spoken: Spoken,
): CaptureStage {
  return current.kind === 'turn' && current.spoken === spoken
    ? { ...current, draft, unheard: true }
    : current;
}

export function useCaptureFlow(dependencies: CaptureDependencies): CaptureFlow {
  const [stage, setStage] = useState<CaptureStage>({ kind: 'idle' });
  const [home, setHome] = useState<HomeView | null>(null);
  const [monthCard, setMonthCard] = useState<Date | null>(null);
  const [history, setHistory] = useState<readonly HistoryDay[] | null>(null);
  const [knownTopics, setKnownTopics] = useState<readonly string[]>([]);
  const [recorded, setRecorded] = useState<ReadonlySet<string> | null>(null);
  const [journalFilter, setJournalFilter] = useState<readonly string[]>([]);
  /*
   * Kept in the flow like the filter, so it survives opening an entry and
   * coming back, and cleared when the journal is opened from the bar.
   */
  const [journalQuery, setJournalQuery] = useState('');
  const [journalFocus, setJournalFocus] = useState<JournalFocus | null>(null);
  /*
   * The take behind the draft on screen, held only until it is confirmed or
   * abandoned. Not on the entry: MoodEntry is about what someone felt, and a
   * path on disk is not that.
   */
  const takeUri = useRef<string | null>(null);
  /** The same take for the card to play back: a ref is not drawn. */
  const [take, setTake] = useState<string | null>(null);
  const holdTake = useCallback((uri: string | null) => {
    takeUri.current = uri;
    setTake(uri);
  }, []);

  /*
   * Once the take's fate is settled. A kept take has been moved into the
   * recordings by then; one that was not kept — nothing heard, keeping
   * recordings off, a move that failed — is removed rather than left in the
   * recorder's scratch space, where nothing else would remove it.
   */
  const letTakeGo = useCallback(() => {
    if (takeUri.current !== null) {
      dependencies.recorder.discard(takeUri.current);
      holdTake(null);
    }
  }, [dependencies.recorder, holdTake]);
  const [parked, setParked] = useState<ParkedTake | null>(null);
  const [micStatus, setMicStatus] = useState<PermissionStatus>('undetermined');
  const [milestones, setMilestones] = useState<readonly Milestone[]>([]);
  const [milestoneSheet, setMilestoneSheet] = useState<MilestoneSheetState | null>(null);

  const { getHomeView, parkedTake, microphonePermission, getMilestones } = dependencies;

  const reloadMilestones = useCallback(() => {
    void getMilestones
      .execute()
      .then(setMilestones)
      .catch(() => {
        setMilestones([]);
      });
  }, [getMilestones]);

  useEffect(reloadMilestones, [reloadMilestones]);

  useEffect(() => {
    void microphonePermission
      .status()
      .then(setMicStatus)
      .catch(() => {
        // Not knowing is not a refusal; the tap will ask.
        setMicStatus('undetermined');
      });
  }, [microphonePermission]);

  const reloadParked = useCallback(() => {
    void parkedTake
      .parked()
      .then(setParked)
      .catch(() => {
        setParked(null);
      });
  }, [parkedTake]);

  useEffect(reloadParked, [reloadParked]);

  /*
   * Undefined until the store has answered, so home does not show the waiting
   * shape for a moment and then swap it for the one already picked.
   */
  const [keptAffirmation, setKeptAffirmation] = useState<KeptAffirmation | null | undefined>(undefined);

  // Read again whenever it might have run out: on every way home and into the journal.
  const reloadKeptAffirmation = useCallback(() => {
    if (dependencies.affirmationFrequency === null) {
      return;
    }

    void dependencies.keepAffirmation
      .current(dependencies.affirmationFrequency)
      .then(setKeptAffirmation)
      .catch(() => {
        setKeptAffirmation(null);
      });
  }, [dependencies.keepAffirmation, dependencies.affirmationFrequency]);

  // A new frequency can end the kept one's period at once.
  useEffect(reloadKeptAffirmation, [reloadKeptAffirmation]);

  const reloadHome = useCallback(() => {
    reloadKeptAffirmation();
    void getHomeView
      .execute(RECENT_LIMIT)
      .then(setHome)
      .catch(() => {
        // A missing recent list is not worth blocking the capture path over.
        setHome(null);
      });

    /*
     * The first-days card: shown while the previous month's piece is fresh
     * and that month held enough to write about. The shape only — no prose
     * is paid for from the home screen.
     */
    if (dependencies.getMonthSummary.isFresh()) {
      void dependencies.getMonthSummary
        .execute({ withNarrative: false })
        .then((month) => {
          setMonthCard(month.hasEnough ? month.monthStart : null);
        })
        .catch(() => {
          setMonthCard(null);
        });
    } else {
      setMonthCard(null);
    }
  }, [dependencies.getMonthSummary, getHomeView, reloadKeptAffirmation]);

  /** Every list an entry shows in, read again after it went or came back. */
  const refreshAfterDelete = useCallback(async (): Promise<void> => {
    reloadHome();
    setHistory(await dependencies.getHistory.execute());
    setRecorded(await dependencies.findRecordedEntries.execute());
  }, [dependencies.getHistory, dependencies.findRecordedEntries, reloadHome]);

  useEffect(reloadHome, [reloadHome]);

  useEffect(() => {
    // On open, for every recording made before AAC and any take whose
    // compression a closed app cut short. Nothing waits on it.
    void dependencies.compactRecordings.execute().catch(() => undefined);
  }, [dependencies.compactRecordings]);

  /*
   * Entries saved while Vidlun could not listen are listened to when the app
   * opens, and App calls this again whenever it comes back to the front: the
   * person who lost the network on the bus has it again at home, and the
   * journal fills in.
   */
  const hearUnheard = useCallback(() => {
    void dependencies.hearUnheardEntries
      .execute()
      .then((heard) => {
        if (heard > 0) {
          reloadHome();
        }
      })
      .catch(() => undefined);
  }, [dependencies.hearUnheardEntries, reloadHome]);

  useEffect(hearUnheard, [hearUnheard]);

  /*
   * The voice of each kept recording is measured in the background — after a
   * save, on opening and on coming back to the front — and the recordings kept
   * before this existed are measured the same way. Nothing waits on it.
   */
  const measureVoices = useCallback(() => {
    void dependencies.measureVoices.execute().catch(() => undefined);
  }, [dependencies.measureVoices]);

  useEffect(measureVoices, [measureVoices]);

  /*
   * How the take sounded against the person's usual voice, measured while
   * the words are being recognised, for the analysis to weigh beside them.
   * Never waited on past a moment: a voice that cannot be described in that
   * time leaves the words to speak alone, and the card does not wait.
   */
  const hearVoice = useCallback(
    (uri: string): Promise<VoiceCue | null> =>
      Promise.race([
        dependencies.describeVoice.ofTake(uri).catch(() => null),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            resolve(null);
          }, VOICE_PATIENCE_MS);
        }),
      ]),
    [dependencies.describeVoice],
  );

  const [notice, setNotice] = useState<Notice | null>(null);
  const noticesShown = useRef(0);

  const notify = useCallback((body: NoticeBody) => {
    noticesShown.current += 1;
    setNotice({ ...body, id: noticesShown.current });
  }, []);

  /**
   * Says what went wrong without taking the screen. `backTo` is where the
   * stage goes when it was somewhere transient — the wait, the take — and
   * absent when the screen that started the work should simply keep it.
   */
  const fail = useCallback(
    (error: unknown, backTo?: CaptureStage) => {
      if (error instanceof RecordingCancelledError) {
        setStage({ kind: 'idle' });

        return;
      }

      if (backTo !== undefined) {
        setStage(backTo);
      }

      notify(noticeFor(error));
    },
    [notify],
  );

  const [update, setUpdate] = useState<StoreRelease | null>(null);
  const updateCheckedAt = useRef<number | null>(null);

  const checkForUpdate = useCallback(() => {
    const now = dependencies.clock.now().getTime();

    if (updateCheckedAt.current !== null && now - updateCheckedAt.current < UPDATE_CHECK_EVERY_MS) {
      return;
    }

    updateCheckedAt.current = now;
    void dependencies.checkForUpdate
      .execute()
      .then(setUpdate)
      .catch(() => undefined);
  }, [dependencies.checkForUpdate, dependencies.clock]);

  useEffect(checkForUpdate, [checkForUpdate]);

  /*
   * Worked out as the saved screen shows and spent on the way home: the
   * rating request is never put inside an entry (2026-10-30), and the saved
   * screen is still the entry's.
   */
  const reviewDue = useRef(false);

  useEffect(() => {
    if (stage.kind === 'history') {
      reloadKeptAffirmation();
    }
  }, [reloadKeptAffirmation, stage.kind]);

  /*
   * The page opens on what is kept, if anything is, so it is read first: the
   * five must not flash up and then be swapped for the one already picked.
   */
  const showAffirmation = useCallback(
    () => {
      // Before the store answers, the period it was picked under.
      void dependencies.keepAffirmation
        .current(dependencies.affirmationFrequency ?? undefined)
        .catch(() => null)
        .then((kept) => {
          setKeptAffirmation(kept);
          setStage({ kind: 'affirmation', kept });
        });
    },
    [dependencies.keepAffirmation, dependencies.affirmationFrequency],
  );

  /** A tap on the affirmation that came while an entry was being made. */
  const [affirmationWaiting, setAffirmationWaiting] = useState(false);
  // Read by the tap's opener, which stays the same function so the listener is not re-made.
  const stageKind = useRef(stage.kind);

  stageKind.current = stage.kind;

  useEffect(() => {
    if (affirmationWaiting && stage.kind === 'idle') {
      setAffirmationWaiting(false);
      showAffirmation();
    }
  }, [affirmationWaiting, showAffirmation, stage.kind]);

  const noteReviewMoment = useCallback(() => {
    void dependencies.askForReview
      .isDue()
      .then((due) => {
        reviewDue.current = due;
      })
      .catch(() => {
        reviewDue.current = false;
      });
  }, [dependencies.askForReview]);

  /**
   * The question goes up as soon as there are words, and the analysis runs
   * behind it. Whoever finishes second decides what happens next: the person
   * waits a moment, or the model was ready before they were and nothing waits
   * at all.
   *
   * Spoken or typed makes no difference here: naming the feeling before
   * seeing Vidlun's answer is the point of the question, and the words were
   * the person's own either way.
   */
  /*
   * Counts the cards put up, and one thrown away. A reading answers only the
   * card it was asked for: one that comes back for a card that is gone says
   * nothing.
   */
  const cardsAsked = useRef(0);
  /*
   * The last deletion, held for the seconds it can be undone (owner's word,
   * 2026-11-19), and a count that gives each its own undo line. A second
   * deletion makes the first final: one line at a time.
   */
  const pendingDelete = useRef<DeletedEntry | null>(null);
  const deletions = useRef(0);
  const [undoable, setUndoable] = useState<number | null>(null);
  /*
   * How this card's words become a draft, kept so a corrected transcript can
   * be re-read the same way the original was — voice stays voice and typed
   * stays typed without the stage having to know which it is holding.
   */
  const rebuild = useRef<{
    readonly heard: (words: Spoken) => Promise<Reading>;
    readonly unheard: (words: Spoken) => MoodEntry;
  } | null>(null);

  /*
   * Saves what the person said and named while Vidlun could not listen. The
   * entry is theirs in full — their words, their transcript — and Vidlun's
   * answer is owed rather than lost: the id is kept for HearUnheardEntries,
   * which fills it in the next time the network is there.
   */
  const saveUnheard = useCallback(
    (
      draft: MoodEntry,
      chosen: readonly string[],
      spoken: Spoken,
      mood: number | null,
      added: readonly string[],
    ) => {
      const confirmed = MoodEntry.create({
        ...draft.toProps(),
        selfEmotionIds: chosen,
        emotionIds: chosen,
        proposedEmotionIds: [],
        mood: mood === null ? draft.mood : MoodScore.of(mood),
        // The person's own topics; Vidlun's join them once it has heard the entry.
        contextTags: keptTopics({ proposed: draft.contextTags, dropped: [], added }),
      });

      setStage({ kind: 'processing' });

      dependencies.confirmEntry
        .execute({
          proposed: draft,
          confirmed,
          recordingUri: dependencies.keepRecordings ? (takeUri.current ?? undefined) : undefined,
        })
        .then(async () => {
          await dependencies.unheardEntries.add(confirmed.id);
          dependencies.haptics.success();
          letTakeGo();
          measureVoices();

          const refreshed = await dependencies.getHomeView.execute(RECENT_LIMIT);

          setHome(refreshed);
          setStage({
            kind: 'saved',
            streakDays: refreshed.streakDays,
            offersGrounding: false,
            unheard: true,
          });
          noteReviewMoment();
        })
        .catch((error: unknown) => {
          // The words and the answer are still in hand: the card comes back
          // as it stood, for one more tap on "save".
          fail(error, {
            kind: 'turn',
            // Back on the step the save was asked from, for one more tap on it.
            step: 'mood',
            spoken,
            chosen,
            draft,
            nearby: [],
            holding: false,
            unheard: true,
            together: false,
            mood,
            droppedTopics: [],
            addedTopics: added,
            namedAlone: null,
          });
        });
    },
    [dependencies, fail, letTakeGo, measureVoices, noteReviewMoment],
  );

  const ask = useCallback(
    (
      spoken: Spoken,
      build: (words: Spoken) => Promise<Reading>,
      unheard: (words: Spoken) => MoodEntry,
    ) => {
      rebuild.current = { heard: build, unheard };
      cardsAsked.current += 1;

      const thisCard = cardsAsked.current;

      /*
       * Always asked: the question is no longer a setting (owner's word,
       * 2026-10-01). Every entry opens on the words nearest to what was
       * said, to choose from or to answer with one's own.
       */
      setStage({
        kind: 'turn',
        step: 'words',
        spoken,
        chosen: [],
        draft: null,
        nearby: [],
        holding: false,
        unheard: false,
        together: false,
        mood: null,
        droppedTopics: [],
        addedTopics: [],
        namedAlone: null,
      });

      build(spoken)
        .then((reading) => {
          setStage((current) =>
            whenAnalysisLands(current, reading.draft, spoken.text, reading.nearbyEmotionIds),
          );
        })
        .catch(() => {
          // A card thrown away has no entry left to say "no network" about.
          if (cardsAsked.current !== thisCard) {
            return;
          }

          /*
           * Vidlun could not listen — no network, or none fast enough. The
           * words are not lost for it: the card goes on with the person's
           * answer alone, the entry is saved as theirs, and Vidlun's answer
           * is listened for later.
           */
          const draft = unheard(spoken);

          notify({ kind: 'unheard' });
          setStage((current) => whenAnalysisFails(current, draft, spoken));
        });
    },
    [notify, saveUnheard],
  );

  /*
   * The person answered first and Vidlun failed second: the moment the
   * failure lands on a card already being held, the answer is saved as it
   * stands.
   */
  useEffect(() => {
    if (stage.kind === 'turn' && stage.unheard && stage.holding && stage.draft !== null) {
      saveUnheard(stage.draft, stage.chosen, stage.spoken, stage.mood, stage.addedTopics);
    }
  }, [saveUnheard, stage]);

  /**
   * Yesterday evening, while the person fills the day they missed; null the
   * rest of the time. Nine o'clock, because the entry speaks for the whole
   * day and the evening is where days get summed up.
   */
  const backfillAt = useRef<Date | null>(null);

  const plansAsked = useRef(0);

  const openSubscription = useCallback(() => {
    plansAsked.current += 1;
    const ask = plansAsked.current;

    setStage(whenPlansAsked(ask));

    // Asked for every time the screen opens: prices move, and a price
    // remembered from last week is a price we would be quoting wrongly.
    void dependencies.purchases
      .plans()
      .then((plans) => {
        setStage((current) => whenPlansArrive(current, plans, ask));
      })
      .catch(fail);
  }, [dependencies.purchases, fail]);

  /*
   * Two entries a day are free (owner's word, 2026-11-16); past them, a new
   * one opens the subscription instead. Checked where every way in starts —
   * the button, the text, yesterday's, the widget and Siri — and against the
   * count home last read, which a save refreshes.
   */
  const withinDailyLimit = useCallback((): boolean => {
    if (mayWriteAnother(dependencies.hasNarrativeAccess, home?.writtenToday ?? 0)) {
      return true;
    }

    openSubscription();

    return false;
  }, [dependencies.hasNarrativeAccess, home, openSubscription]);

  const record = useCallback(() => {
    // Not awaited, and its failure is not ours: the take must start now, and
    // an unopened model only means the transcription pays for it later.
    void dependencies.transcribeTake.prepare();

    dependencies.recorder
      .start()
      .then(async (take) => {
        // Fires for a tap and for the ceiling alike: the person may not be looking.
        dependencies.haptics.settle();

        holdTake(take.uri);
        setStage({ kind: 'processing' });

        // Alongside the recognition, not after it: both read the same file.
        const voice = hearVoice(take.uri);
        const spoken = await dependencies.transcribeTake.execute(take);

        ask(
          spoken,
          (words) =>
            voice.then((cue) =>
              dependencies.createVoiceEntry.execute(words, backfillAt.current ?? undefined, cue),
            ),
          (words) =>
            dependencies.createUnheardEntry.execute(words, 'voice', backfillAt.current ?? undefined),
        );
      })
      .catch((error: unknown) => {
        // Nothing heard, or nothing could be: the take has no entry to go to.
        letTakeGo();
        fail(error, { kind: 'idle' });
      });
  }, [ask, dependencies, fail, hearVoice, letTakeGo]);

  const startRecording = useCallback(() => {
    if (!withinDailyLimit()) {
      return;
    }

    backfillAt.current = null;
    dependencies.haptics.tap();

    /*
     * The recorder throws a raw native exception when the system has not
     * granted the microphone, whether refused or never asked. Asking is
     * ours to do — someone who skipped it at onboarding gets the prompt at
     * the first tap — and a refusal is a state home can name, not a failure
     * screen quoting Swift.
     */
    const withPermission = async (): Promise<boolean> => {
      const current = await dependencies.microphonePermission.status();
      const settled =
        current === 'undetermined' ? await dependencies.microphonePermission.request() : current;

      setMicStatus(settled);

      return settled === 'granted';
    };

    void withPermission()
      .then((allowed) => {
        if (!allowed) {
          return;
        }

        setStage({ kind: 'recording' });
        record();
      })
      .catch((error: unknown) => {
        fail(error, { kind: 'idle' });
      });
  }, [dependencies, fail, record]);

  const continueParked = useCallback(() => {
    setStage({ kind: 'processing' });

    void dependencies.parkedTake
      .parked()
      .then(async (waiting) => {
        if (waiting === null) {
          setParked(null);
          setStage({ kind: 'idle' });

          return;
        }

        backfillAt.current = waiting.recordedAt;
        holdTake(waiting.recording.uri);
        setParked(null);

        const voice = hearVoice(waiting.recording.uri);
        const spoken = await dependencies.transcribeTake.execute(waiting.recording);

        /*
         * Released only now, and released rather than cleared: the file is
         * what the model just read and what the entry will keep as its
         * recording. Clearing it before the read handed the model a path
         * with nothing behind it — "Invalid WAV file" on a take that was
         * fine. A take the model could not read stays parked: a later
         * launch, or a re-downloaded model, may still manage it.
         */
        await dependencies.parkedTake.release();

        ask(
          spoken,
          (words) =>
            voice.then((cue) => dependencies.createVoiceEntry.execute(words, waiting.recordedAt, cue)),
          (words) => dependencies.createUnheardEntry.execute(words, 'voice', waiting.recordedAt),
        );
      })
      .catch((error: unknown) => {
        reloadParked();
        fail(error, { kind: 'idle' });
      });
  }, [ask, dependencies, fail, hearVoice, reloadParked]);

  /*
   * A take parked by an earlier version — recorded before the model came
   * with the app — is read as soon as its screen opens, without a tap.
   * Until then home offers it: a card appearing over whatever the person
   * was doing is not the product's manners.
   */
  useEffect(() => {
    if (stage.kind === 'parked') {
      continueParked();
    }
  }, [continueParked, stage.kind]);

  /**
   * The week and its themes. The vocabulary is a separate screen and a
   * separate read, so opening the week no longer pays for a month of history
   * nobody asked to see.
   */
  const loadStats = useCallback(
    (weeksBack: number) => {
      setStage({ kind: 'stats', weeksBack, view: null });

      const containing = weeksAgo(dependencies.clock.now(), weeksBack);

      void dependencies.getWeekSummary
        .execute({ containing })
        .then(async (week) => {
          const [themes, patterns, neighbours] = await Promise.all([
            dependencies.getWeekThemes.execute({
              weekStart: week.weekStart,
              weekEnd: week.weekEnd,
            }),
            // The week on screen and nothing around it (owner's word,
            // 2026-11-06); the month read every October week the same.
            dependencies.findMoodPatterns.execute({
              weekStart: week.weekStart,
              weekEnd: week.weekEnd,
            }),
            /*
             * Where the arrows lead: over the empty weeks to the nearest one
             * with entries (owner's word, 2026-10-30), and nowhere before the
             * journal began.
             */
            dependencies.getWeekNeighbours.execute({ weeksBack }),
          ]);

          setStage((current) =>
            // Someone who navigated on while this was in flight gets the week
            // they asked for, not the one that happened to finish.
            current.kind === 'stats' && current.weeksBack === weeksBack
              ? {
                  ...current,
                  view: {
                    week,
                    themes,
                    patterns,
                    weeksBack,
                    earlierWeeksBack: neighbours.earlierWeeksBack,
                    laterWeeksBack: neighbours.laterWeeksBack,
                    hasNarrativeAccess: dependencies.hasNarrativeAccess,
                  },
                }
              : current,
          );
        })
        .catch(fail);
    },
    [dependencies, fail],
  );


  /*
   * The month's page: its shape first, read off the phone at once, then the
   * prose, a model call that takes seconds and is cached after. The prose is
   * the paid half, so without it the card leads to what it costs instead.
   */
  const showMonth = useCallback(
    (month: Date | undefined, from: 'idle' | 'months') => {
      if (!dependencies.hasNarrativeAccess) {
        openSubscription();

        return;
      }

      setStage({ kind: 'month', month: null, from, voice: null });

      void dependencies.getMonthSummary
        .execute({ withNarrative: false, month })
        .then(async (shape) => {
          setStage((current) => (current.kind === 'month' ? { ...current, month: shape } : current));

          // The voice is gathered beside the prose; one that cannot be leaves the page as it was.
          void dependencies.getMonthVoice
            .execute(shape.monthStart)
            .then((voice) => {
              setStage((current) =>
                current.kind === 'month' && current.month?.monthStart.getTime() === shape.monthStart.getTime()
                  ? { ...current, voice }
                  : current,
              );
            })
            .catch(() => undefined);

          const written = await dependencies.getMonthSummary.execute({ withNarrative: true, month });

          setStage((current) => (current.kind === 'month' ? { ...current, month: written } : current));
        })
        .catch((error: unknown) => {
          // From the list the page stays, its back arrow intact; from home it closes.
          fail(error, from === 'idle' ? { kind: 'idle' } : undefined);
        });
    },
    [
      dependencies.getMonthSummary,
      dependencies.getMonthVoice,
      dependencies.hasNarrativeAccess,
      fail,
      openSubscription,
    ],
  );

  const openMonth = useCallback(() => {
    showMonth(undefined, 'idle');
  }, [showMonth]);

  const openMonths = useCallback(() => {
    setStage({ kind: 'months', months: null });

    void dependencies.getPastMonths
      .execute()
      .then((months) => {
        setStage((current) => (current.kind === 'months' ? { ...current, months } : current));
      })
      .catch((error: unknown) => {
        fail(error, { kind: 'idle' });
      });
  }, [dependencies.getPastMonths, fail]);

  const loadVocabulary = useCallback(
    (period?: { readonly from: Date; readonly to: Date }) => {
      setStage((current) =>
        current.kind === 'vocabulary'
          ? { ...current, growth: null }
          : { kind: 'vocabulary', growth: null, earliest: null, entryDays: new Map<number, number | null>() },
      );

      void Promise.all([
        dependencies.getVocabularyGrowth.execute(period ?? {}),
        // The whole journal, for the one date the calendar needs: there is no
        // point offering a month that predates the first thing ever written.
        dependencies.getHistory.execute(),
      ])
        .then(([growth, history]) => {
          /*
           * The start of that day, not the minute of it. An entry written at
           * 21:58 made every hour of its own day count as before the journal
           * began, so today and yesterday were both unpickable in the calendar.
           */
          const first = history.at(-1)?.entries.at(-1)?.createdAt ?? growth.from;
          const oldest = new Date(first.getFullYear(), first.getMonth(), first.getDate());

          setStage((current) =>
            current.kind === 'vocabulary'
              ? { ...current, growth, earliest: oldest, entryDays: entryDays(history) }
              : current,
          );
        })
        .catch(fail);
    },
    [dependencies.getHistory, dependencies.getVocabularyGrowth, fail],
  );

  const save = useCallback(
    (proposed: MoodEntry, draft: MoodEntry, backTo: CaptureStage, declined = false) => {
      setStage({ kind: 'processing' });

      dependencies.confirmEntry
        .execute({
          proposed,
          confirmed: draft,
          recordingUri: dependencies.keepRecordings ? (takeUri.current ?? undefined) : undefined,
          keptOwnWords: declined,
        })
        .then(async () => {
          dependencies.haptics.success();

          letTakeGo();
          measureVoices();

          const refreshed = await dependencies.getHomeView.execute(RECENT_LIMIT);

          setHome(refreshed);
          setStage({
            kind: 'saved',
            streakDays: refreshed.streakDays,
            offersGrounding: draft.safetyFlag === 'distress',
            unheard: false,
          });
          noteReviewMoment();
        })
        .catch((error: unknown) => {
          // Nothing was written; the card comes back with the draft as it stood.
          fail(error, backTo);
        });
    },
    [dependencies, fail, letTakeGo, measureVoices, noteReviewMoment],
  );

  const confirm = useCallback(() => {
    if (stage.kind === 'reflecting') {
      save(stage.proposed, stage.draft, stage);
    }
  }, [save, stage]);

  /*
   * The answer that needs no card. If the save fails, the plain card comes
   * up with the draft, so saving is one tap away from trying again.
   */
  useEffect(() => {
    if (stage.kind === 'saving') {
      save(
        stage.proposed,
        stage.draft,
        { kind: 'reflecting', proposed: stage.proposed, draft: stage.draft },
        stage.declined,
      );
    }
  }, [save, stage]);

  return {
    stage,
    notice,
    dismissNotice: useCallback(() => {
      setNotice(null);
    }, []),
    monthCard,
    update,
    checkForUpdate,
    home,
    reloadHome,
    hearUnheard,
    measureVoices,
    startRecording,
    stopRecording: useCallback(() => {
      dependencies.recorder.stop();
    }, [dependencies.recorder]),
    pauseRecording: useCallback(() => {
      void dependencies.recorder.pause();
    }, [dependencies.recorder]),
    resumeRecording: useCallback(() => {
      /*
       * A microphone that will not come back still leaves what was said, and
       * that is kept the way the stop button keeps it rather than lost.
       */
      dependencies.recorder.resume().catch(() => {
        dependencies.recorder.stop();
      });
    }, [dependencies.recorder]),
    voiceLevel: useCallback(() => dependencies.recorder.level(), [dependencies.recorder]),
    recordingInterrupted: useCallback(
      () => dependencies.recorder.interrupted(),
      [dependencies.recorder],
    ),
    cancel: useCallback(() => {
      dependencies.recorder.cancel();
      setStage({ kind: 'idle' });
    }, [dependencies.recorder]),
    parked,
    micStatus,
    continueParked,
    milestones,
    milestoneSheet,
    openMilestone: useCallback((milestone?: Milestone) => {
      setMilestoneSheet({ editing: milestone ?? null });
    }, []),
    closeMilestone: useCallback(() => {
      setMilestoneSheet(null);
    }, []),
    saveMilestone: useCallback(
      (label: string) => {
        void dependencies.markMilestone
          .execute(label, milestoneSheet?.editing?.id ?? null)
          .then(() => {
            setMilestoneSheet(null);
            reloadMilestones();
          })
          .catch(fail);
      },
      [dependencies.markMilestone, fail, milestoneSheet, reloadMilestones],
    ),
    deleteMilestone: useCallback(() => {
      const editing = milestoneSheet?.editing;

      if (editing === undefined || editing === null) {
        setMilestoneSheet(null);

        return;
      }

      void dependencies.forgetMilestone
        .execute(editing.id)
        .then(() => {
          setMilestoneSheet(null);
          reloadMilestones();
        })
        .catch(fail);
    }, [dependencies.forgetMilestone, fail, milestoneSheet, reloadMilestones]),
    startWriting: useCallback(() => {
      if (!withinDailyLimit()) {
        return;
      }

      backfillAt.current = null;
      setStage({ kind: 'writing' });
    }, [withinDailyLimit]),
    startYesterday: useCallback(() => {
      if (!withinDailyLimit()) {
        return;
      }

      const now = dependencies.clock.now();

      backfillAt.current = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 21, 0);
      setStage({ kind: 'writing' });
    }, [dependencies.clock, withinDailyLimit]),
    submitText: useCallback(
      (text: string) => {
        holdTake(null);
        // Full confidence for the same reason CreateTextEntry grants it:
        // nothing was heard, so nothing was misheard.
        ask(
          { text: text.trim(), confidence: Confidence.of(1) },
          (words) => dependencies.createTextEntry.execute(words.text, backfillAt.current ?? undefined),
          (words) =>
            dependencies.createUnheardEntry.execute(words, 'text', backfillAt.current ?? undefined),
        );
      },
      [ask, dependencies.createTextEntry],
    ),
    confirm,
    backHome: useCallback(() => {
      setStage({ kind: 'idle' });
      reloadHome();
    }, [reloadHome]),
    openAffirmation: useCallback(() => {
      if (MAKING_AN_ENTRY.has(stageKind.current)) {
        setAffirmationWaiting(true);

        return;
      }

      showAffirmation();
    }, [showAffirmation]),
    // From home's button (owner's word, 2026-11-16), so closing goes home.
    pickAffirmation: showAffirmation,
    closeAffirmation: useCallback(() => {
      setStage({ kind: 'idle' });
      reloadHome();
    }, [reloadHome]),
    keepAffirmation: useCallback(
      (choice: AffirmationChoice, frequency: AffirmationFrequency) => {
        void dependencies.keepAffirmation
          .keep(choice, frequency)
          .then(setKeptAffirmation)
          .catch(() => undefined);
      },
      [dependencies.keepAffirmation],
    ),
    keptAffirmation,
    leaveSaved: useCallback(() => {
      setStage({ kind: 'idle' });
      reloadHome();

      if (!reviewDue.current) {
        return;
      }

      reviewDue.current = false;
      setTimeout(() => {
        void dependencies.askForReview.ask().catch(() => undefined);
      }, REVIEW_AFTER_HOME_MS);
    }, [reloadHome, dependencies.askForReview]),
    history,
    recorded,
    journalFilter,
    journalQuery,
    searchJournal: setJournalQuery,
    filterJournal: useCallback((emotionIds: readonly string[]) => {
      setJournalFocus(null);
      setJournalFilter(emotionIds);
    }, []),
    journalFocus,
    openJournalFocus: useCallback(
      (focus: JournalFocus) => {
        setStage({ kind: 'history' });
        setJournalFilter([]);
        setJournalQuery('');
        setJournalFocus(focus);
        void dependencies.getHistory.execute().then(setHistory).catch(fail);
        void dependencies.findRecordedEntries.execute().then(setRecorded).catch(() => undefined);
      },
      [dependencies.getHistory, dependencies.findRecordedEntries, fail],
    ),
    clearJournalFocus: useCallback(() => {
      setJournalFocus(null);
    }, []),
    openEntry: useCallback(
      (entry: MoodEntry, found?: string) => {
        const query = found === undefined ? null : SearchQuery.of(found);

        setStage((current) => ({
          kind: 'detail',
          entry,
          recordingUri: null,
          voice: null,
          from: current.kind === 'history' ? 'history' : 'idle',
          backTo: current.kind === 'month' ? current : null,
          found: query === null ? null : (found ?? null),
          playFromMs: null,
        }));

        // Measured now if it never was; a voice that cannot be read says nothing.
        void dependencies.describeVoice
          .hearEntry(entry.id)
          .catch((): VoiceHeard => ({ kind: 'silent' }))
          .then((voice) => {
            setStage((current) =>
              current.kind === 'detail' && current.entry.id === entry.id ? { ...current, voice } : current,
            );
          });

        void dependencies.findRecording
          .execute(entry.id)
          .then(async (uri) => {
            // Only if the same entry is still open: the lookup is quick, but
            // quick is not instant and people tap on.
            setStage((current) =>
              current.kind === 'detail' && current.entry.id === entry.id
                ? { ...current, recordingUri: uri }
                : current,
            );

            /*
             * Opened from a search: where the word is said, so the player
             * starts there (owner's word, 2026-11-20). Read from the file each
             * time; nothing about it is stored.
             */
            if (uri === null || query === null) {
              return;
            }

            const playFromMs = await dependencies.findSpokenMoment.execute(entry, uri, query);

            setStage((current) =>
              current.kind === 'detail' && current.entry.id === entry.id
                ? { ...current, playFromMs }
                : current,
            );
          })
          .catch(() => undefined);
      },
      [dependencies.findRecording, dependencies.describeVoice, dependencies.findSpokenMoment],
    ),
    closeEntry: useCallback(() => {
      setStage((current) => (current.kind === 'detail' ? (current.backTo ?? { kind: current.from }) : current));
      reloadHome();
    }, [reloadHome]),
    toggleOwnWord: useCallback((id: string) => {
      setStage((current) => {
        if (current.kind !== 'turn') {
          return current;
        }

        const chosen = current.chosen.includes(id)
          ? current.chosen.filter((each) => each !== id)
          : current.chosen.length >= MoodEntry.MAX_EMOTIONS
            ? current.chosen
            : [...current.chosen, id];

        return { ...current, chosen };
      });
    }, []),
    addOwnWord: useCallback((id: string) => {
      setStage((current) =>
        current.kind !== 'turn' ||
        current.chosen.includes(id) ||
        current.chosen.length >= MoodEntry.MAX_EMOTIONS
          ? current
          : { ...current, chosen: [...current.chosen, id] },
      );
    }, []),
    setMood: useCallback((value: number) => {
      setStage((current) => whenMoodSet(current, value));
    }, []),
    toggleTopic: useCallback((tag: string) => {
      setStage((current) => {
        if (current.kind !== 'turn') {
          return current;
        }

        const topics = withTopicToggled(topicsOf(current), tag);

        return { ...current, droppedTopics: topics.dropped, addedTopics: topics.added };
      });
    }, []),
    addTopic: useCallback(
      (typed: string) => {
        setStage((current) => {
          if (current.kind !== 'turn') {
            return current;
          }

          const topics = withTopicAdded(topicsOf(current), typed, knownTopics);

          return { ...current, droppedTopics: topics.dropped, addedTopics: topics.added };
        });
      },
      [knownTopics],
    ),
    readKnownTopics: useCallback(() => {
      void dependencies.knownTopics
        .execute()
        .then(setKnownTopics)
        .catch(() => undefined);
    }, [dependencies.knownTopics]),
    toFeelings: useCallback(() => {
      setStage((current) => whenStepped(current, 'feelings'));
    }, []),
    toMood: useCallback(() => {
      setStage((current) => whenStepped(current, 'mood'));
    }, []),
    stepBack: useCallback(() => {
      setStage(whenSteppedBack);
    }, []),
    take,
    answer: useCallback(() => {
      // Vidlun could not listen: nothing to compare against, and nothing
      // coming. The answer given is the whole entry.
      if (stage.kind === 'turn' && stage.unheard && stage.draft !== null) {
        saveUnheard(stage.draft, stage.chosen, stage.spoken, stage.mood, stage.addedTopics);

        return;
      }

      // Nothing to compare against yet: hold, and the analysis will carry
      // the card forward the moment it lands.
      setStage(whenAnswered);
    }, [saveUnheard, stage]),
    openTogether: useCallback(() => {
      setStage(whenTogetherOpened);
    }, []),
    chooseTogether: useCallback((ids: readonly string[]) => {
      setStage((current) => whenChosenTogether(current, ids));
    }, []),
    correctWording: useCallback(
      (text: string) => {
        const corrected = text.trim();

        const builders = rebuild.current;

        if (
          stage.kind !== 'turn' ||
          builders === null ||
          corrected.length === 0 ||
          corrected === stage.spoken.text
        ) {
          return;
        }

        /*
         * Corrected by the person who said it, so nothing is misheard any
         * more — the same full confidence a typed entry carries, and with it
         * the same right to the vocabulary's deepest words.
         */
        const spoken: Spoken = { text: corrected, confidence: Confidence.of(1) };

        // The draft in hand was read off the mishearing; none of it survives,
        // nor does a failure to read it. Their own named words do — the
        // feeling never depended on the typo.
        setStage({ ...stage, spoken, draft: null, nearby: [], unheard: false });

        builders
          .heard(spoken)
          .then((reading) => {
            setStage((current) =>
              whenAnalysisLands(current, reading.draft, corrected, reading.nearbyEmotionIds),
            );
          })
          .catch(() => {
            /*
             * The corrected words could not be read either. They are kept
             * the way the first reading's failure kept the misheard ones:
             * as the person's, with Vidlun's answer listened for later.
             */
            const draft = builders.unheard(spoken);

            notify({ kind: 'unheard' });
            setStage((current) => whenAnalysisFails(current, draft, spoken));
          });
      },
      [notify, stage],
    ),
    /*
     * The way out of an entry not yet saved (owner's word, 2026-11-19). The
     * card is not saved, so there is nothing to delete but the take: its file
     * goes now rather than waiting in the recorder's scratch space. A reading
     * still on the way lands on home and changes nothing there, and if it
     * fails it says nothing either — the entry it was for is gone.
     */
    discardEntry: useCallback(() => {
      cardsAsked.current += 1;
      backfillAt.current = null;
      letTakeGo();
      setStage({ kind: 'idle' });
      reloadHome();
    }, [letTakeGo, reloadHome]),
    openSettings: useCallback(() => {
      setStage({ kind: 'settings' });
    }, []),
    openSubscription,
    openMonth,
    openMonths,
    openMonthOf: useCallback(
      (monthStart: Date) => {
        showMonth(monthStart, 'months');
      },
      [showMonth],
    ),
    closeMonth: useCallback(() => {
      // The month's voice joined into one file goes with the page.
      void dependencies.composeMonthVoice.forget();

      if (stage.kind === 'month' && stage.from === 'months') {
        openMonths();

        return;
      }

      setStage({ kind: 'idle' });
      reloadHome();
    }, [dependencies.composeMonthVoice, openMonths, reloadHome, stage]),
    composeMonthVoice: useCallback(
      (voice: MonthVoice, mode: MonthVoiceMode) => dependencies.composeMonthVoice.execute(voice, mode),
      [dependencies.composeMonthVoice],
    ),
    openLegal: useCallback((doc: LegalDocumentKind) => {
      setStage({ kind: 'legal', doc });
    }, []),
    startGrounding: useCallback(() => {
      setStage({ kind: 'grounding', from: 'saved' });
    }, []),
    openGrounding: useCallback(() => {
      setStage({ kind: 'grounding', from: 'settings' });
    }, []),
    leaveGrounding: useCallback(() => {
      if (stage.kind === 'grounding' && stage.from === 'settings') {
        setStage({ kind: 'settings' });

        return;
      }

      setStage({ kind: 'idle' });
      reloadHome();
    }, [reloadHome, stage]),
    noticed: useCallback(() => {
      dependencies.haptics.notice();
    }, [dependencies.haptics]),
    subscribe: useCallback((planId: string) => {
      void dependencies.purchases
        .subscribe(planId)
        .then((outcome) => {
          setStage((current) =>
            current.kind === 'subscription' ? { ...current, outcome } : current,
          );

          if (outcome === 'bought') {
            dependencies.onEntitlementChanged();
          }
        })
        .catch(fail);
    }, [dependencies, fail]),
    restorePurchase: useCallback(() => {
      void dependencies.purchases
        .restore()
        .then((outcome) => {
          setStage((current) =>
            current.kind === 'subscription' ? { ...current, outcome } : current,
          );

          if (outcome === 'restored') {
            dependencies.onEntitlementChanged();
          }
        })
        .catch(fail);
    }, [dependencies, fail]),
    redeemCode: useCallback(() => {
      void dependencies.purchases.redeemCode().catch(() => {
        // The sheet is Apple's and says its own errors; one that would not
        // open leaves the page as it was, with the plan still on it.
      });
    }, [dependencies.purchases]),
    dismissPurchaseOutcome: useCallback(() => {
      setStage((current) => (current.kind === 'subscription' ? { ...current, outcome: null } : current));
    }, []),
    openStats: useCallback(() => {
      loadStats(0);
    }, [loadStats]),
    openVocabulary: useCallback(() => {
      loadVocabulary();
    }, [loadVocabulary]),
    showPeriod: useCallback(
      (period: { readonly from: Date; readonly to: Date }) => {
        loadVocabulary(period);
      },
      [loadVocabulary],
    ),
    /*
     * Read off the stage in hand, not inside a state updater: the updater
     * that returned its state unchanged was bailed out of by React, and the
     * load it called from within never happened — the arrow into last week
     * did nothing on the phone (found 2026-09-22).
     */
    showEarlierWeek: useCallback(() => {
      const earlier = stage.kind === 'stats' ? stage.view?.earlierWeeksBack : null;

      if (earlier !== null && earlier !== undefined) {
        loadStats(earlier);
      }
    }, [loadStats, stage]),
    showLaterWeek: useCallback(() => {
      // Never forward past this week: there is nothing there yet, and an
      // empty week you navigated into reads as one you failed to fill.
      const later = stage.kind === 'stats' ? stage.view?.laterWeeksBack : null;

      if (later !== null && later !== undefined) {
        loadStats(later);
      }
    }, [loadStats, stage]),
    openHistory: useCallback(() => {
      setStage({ kind: 'history' });
      setJournalFilter([]);
      setJournalQuery('');
      setJournalFocus(null);
      void dependencies.getHistory.execute().then(setHistory).catch(fail);
      // A card without its icon until the files answer, rather than a guess.
      void dependencies.findRecordedEntries.execute().then(setRecorded).catch(() => undefined);
    }, [dependencies.getHistory, dependencies.findRecordedEntries, fail]),
    deleteEntry: useCallback(
      (id: string) => {
        // One undo at a time: a deletion still waiting becomes final first.
        void pendingDelete.current?.settle().catch(() => undefined);
        pendingDelete.current = null;
        setUndoable(null);

        // A card opened from the month's voice goes back to the month, which
        // is heard again without the entry.
        const backToMonth = stage.kind === 'detail' && stage.entry.id === id ? stage.backTo : null;
        const monthStart = backToMonth?.month?.monthStart ?? null;

        // Reloading rather than dropping the row locally: the streak is
        // counted from what is stored, and it may have just changed. History
        // is refreshed too, since the row may have been deleted from there.
        void dependencies.deleteEntry
          .execute(id)
          .then(async (deleted) => {
            pendingDelete.current = deleted;
            deletions.current += 1;
            setUndoable(deletions.current);
            // Standing on a card that no longer exists is the one thing the
            // delete must not leave behind. Back to wherever it was opened
            // from — and only for that card, since a row swiped away in a list
            // should leave the list where it is.
            setStage((current) => {
              if (current.kind !== 'detail' || current.entry.id !== id) {
                return current;
              }

              return current.backTo === null ? { kind: current.from } : { ...current.backTo, voice: null };
            });

            if (monthStart !== null) {
              const voice = await dependencies.getMonthVoice.execute(monthStart).catch(() => null);

              setStage((current) =>
                current.kind === 'month' && current.month?.monthStart.getTime() === monthStart.getTime()
                  ? { ...current, voice }
                  : current,
              );
            }

            await refreshAfterDelete();
          })
          .catch(fail);
      },
      [dependencies.deleteEntry, dependencies.getMonthVoice, refreshAfterDelete, fail, stage],
    ),
    undoable,
    undoDelete: useCallback(() => {
      const deleted = pendingDelete.current;

      pendingDelete.current = null;
      setUndoable(null);

      if (deleted === null) {
        return;
      }

      // Back where it was in every list; the card it was opened from stays closed.
      void deleted.restore().then(refreshAfterDelete).catch(fail);
    }, [refreshAfterDelete, fail]),
    settleDelete: useCallback(() => {
      const deleted = pendingDelete.current;

      pendingDelete.current = null;
      setUndoable(null);
      void deleted?.settle().catch(() => undefined);
    }, []),
  };
}
