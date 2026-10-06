import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConfirmEntry } from '@/application/use-cases/ConfirmEntry';
import type { CreateTextEntry } from '@/application/use-cases/CreateTextEntry';
import type { CreateVoiceEntry } from '@/application/use-cases/CreateVoiceEntry';
import type { Spoken, TranscribeTake } from '@/application/use-cases/TranscribeTake';
import type { GetHomeView, HomeView } from '@/application/use-cases/GetHomeView';
import type {
  GetVocabularyGrowth,
  VocabularyGrowth,
} from '@/application/use-cases/GetVocabularyGrowth';
import type { GetWeekSummary } from '@/application/use-cases/GetWeekSummary';
import type { FindMoodPatterns } from '@/application/use-cases/FindMoodPatterns';
import type { GetWeekThemes } from '@/application/use-cases/GetWeekThemes';
import type { SearchEntries, SearchResult } from '@/application/use-cases/SearchEntries';
import type { DeleteEntry } from '@/application/use-cases/DeleteEntry';
import type { FindRecording } from '@/application/use-cases/FindRecording';
import type { ForgetOldRecordings } from '@/application/use-cases/ForgetOldRecordings';
import type { GetHistory, HistoryDay } from '@/application/use-cases/GetHistory';
import type { WriteObservation } from '@/application/use-cases/WriteObservation';
import type { AttachObservation } from '@/application/use-cases/AttachObservation';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import type { LegalDocumentKind } from '@/i18n/legal';
import type { GetMonthSummary, MonthSummary } from '@/application/use-cases/GetMonthSummary';
import type { GetPastMonths, PastMonth } from '@/application/use-cases/GetPastMonths';
import type { StatsView } from '@/presentation/screens/StatsScreen';
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
import type { ForgetMilestone } from '@/application/use-cases/ForgetMilestone';
import type { GetMilestones } from '@/application/use-cases/GetMilestones';
import type { MarkMilestone } from '@/application/use-cases/MarkMilestone';
import type { MilestoneSheetState } from '../components/MilestoneSheet';
import type { IMicrophonePermission, PermissionStatus } from '@/domain/ports/IMicrophonePermission';

/**
 * The card, asking before it answers. One stage rather than two screens: the
 * question and the hold are the same card in two states. The card itself goes
 * up once Vidlun's reading is in (owner's word, 2026-10-01); until then the
 * stage is drawn as the processing screen.
 */
export interface TurnStage {
  readonly kind: 'turn';
  readonly spoken: Spoken;
  /** What the person has named so far. Empty is an answer, not a blank. */
  readonly chosen: readonly string[];
  /** Null until the analysis lands behind the question. */
  readonly draft: MoodEntry | null;
  /** True once they have answered and are waiting on the analysis. */
  readonly holding: boolean;
  /**
   * True when Vidlun could not listen — no network, or none fast enough.
   * The draft is then the words alone, and the person's answer is the
   * whole entry; Vidlun's comes later, through HearUnheardEntries.
   */
  readonly unheard: boolean;
  /**
   * True once the person asked to choose together with Vidlun: the card goes
   * on to Vidlun's words rather than saving their own.
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
  /**
   * Choosing together: Vidlun's words, already chosen, beside whatever the
   * person named on the card (owner's word, 2026-10-01).
   */
  | {
      readonly kind: 'comparing';
      readonly proposed: MoodEntry;
      readonly draft: MoodEntry;
      /** The question card as it was, for the way back to it. */
      readonly card: TurnStage;
    }
  | { readonly kind: 'reflecting'; readonly proposed: MoodEntry; readonly draft: MoodEntry }
  /**
   * The answer is in and the entry is being written — no card in between
   * (owner's word, 2026-09-30). A stage rather than a call so the analysis
   * landing on a card someone already answered can end in a save too.
   */
  | { readonly kind: 'saving'; readonly proposed: MoodEntry; readonly draft: MoodEntry }
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
  /** The one thing sold, and what the store said about buying it. */
  | {
      readonly kind: 'subscription';
      readonly plans: readonly Plan[];
      readonly outcome: PurchaseOutcome | null;
    }
  /**
   * The terms or the privacy policy, opened from the paywall and going back to
   * it. Reachable from nowhere else, which is why leaving is `openSubscription`
   * rather than a remembered origin.
   */
  | { readonly kind: 'legal'; readonly doc: LegalDocumentKind }
  /**
   * The query and the filter live on the stage rather than beside it, so
   * leaving search and coming back starts clean — a screen that remembers what
   * you were looking for last week is one you have to clear before using.
   */
  | {
      readonly kind: 'search';
      readonly query: string;
      readonly emotionId: string | null;
      readonly result: SearchResult | null;
    }
  /**
   * The insights screen. `weeksBack` lives on the stage rather than beside it
   * so that leaving and coming back starts at this week again — a screen that
   * remembers you were reading June is a screen you have to navigate out of.
   */
  | { readonly kind: 'stats'; readonly weeksBack: number; readonly view: StatsView | null }
  /**
   * A month written back: the one just ended behind home's card, or any
   * earlier one from the list of past months (owner's word, 2026-10-06).
   * Null while its shape is read; the prose is written in after. `from` is
   * where its back arrow goes.
   */
  | { readonly kind: 'month'; readonly month: MonthSummary | null; readonly from: 'idle' | 'months' }
  /** Every past month with something to read, behind the statistics screen. Null while counted. */
  | { readonly kind: 'months'; readonly months: readonly PastMonth[] | null }
  /** The other half of the insights screen, and its own screen in the drawing. */
  | {
      readonly kind: 'vocabulary';
      readonly growth: VocabularyGrowth | null;
      /** The oldest entry there is, so the calendar offers nothing emptier. */
      readonly earliest: Date | null;
    }
  | {
      readonly kind: 'detail';
      /**
       * Where this card was opened from, so closing or deleting it goes back
       * there. Without it every card returns to history, including the ones
       * opened from home.
       */
      readonly from: 'idle' | 'history';
      readonly entry: MoodEntry;
      /** Null while it is being looked up, and if there is none. */
      readonly recordingUri: string | null;
    };

/**
 * A line laid over whatever is on screen, and gone on its own. A failure used
 * to be a screen of its own whose only way out went home, and the entry went
 * with it; now the screen that was there stays, with its work, and the line
 * says what did not go through. `id` tells two identical notices apart, so
 * the same failure twice still shows twice.
 */
export type Notice = NoticeBody & { readonly id: number };

type NoticeBody =
  /** Something did not go through; `message` is the layer below's own words. */
  | { readonly kind: 'failed'; readonly message: string }
  /** Vidlun could not listen: the entry stays the person's, the answer comes later. */
  | { readonly kind: 'unheard' };

export interface CaptureDependencies {
  readonly recorder: IAudioRecorder;
  readonly haptics: IHaptics;
  readonly transcribeTake: TranscribeTake;
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly createTextEntry: CreateTextEntry;
  readonly confirmEntry: ConfirmEntry;
  readonly writeObservation: WriteObservation;
  /** Writes an echo into an entry saved before the echo arrived. */
  readonly attachObservation: AttachObservation;
  readonly deleteEntry: DeleteEntry;
  readonly getHistory: GetHistory;
  readonly forgetOldRecordings: ForgetOldRecordings;
  readonly findRecording: FindRecording;
  /** False stops a confirmed take from being kept at all. */
  readonly keepRecordings: boolean;
  readonly parkedTake: IParkedTake;
  /** The draft for words Vidlun could not listen to; the person's answer still goes in. */
  readonly createUnheardEntry: CreateUnheardEntry;
  /** Where such entries wait to be heard. */
  readonly unheardEntries: IUnheardEntries;
  readonly hearUnheardEntries: HearUnheardEntries;
  readonly microphonePermission: IMicrophonePermission;
  readonly getHomeView: GetHomeView;
  readonly getWeekSummary: GetWeekSummary;
  readonly getMonthSummary: GetMonthSummary;
  readonly getPastMonths: GetPastMonths;
  readonly getWeekThemes: GetWeekThemes;
  readonly findMoodPatterns: FindMoodPatterns;
  readonly searchEntries: SearchEntries;
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
  /** The month being offered on home's first-days card, or null off-season. */
  readonly monthCard: Date | null;
  readonly startRecording: () => void;
  readonly stopRecording: () => void;
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
  /** Trades one of their words for a more exact child of it. */
  readonly refineOwnWord: (parentId: string, childId: string) => void;
  /** Sets the mood on the card's scale, in place of Vidlun's reading. */
  readonly setMood: (value: number) => void;
  /** Takes one of Vidlun's topics off the card, or puts it back. */
  readonly toggleTopic: (tag: string) => void;
  /** Done answering: saves what was named, or waits for the reading to land. */
  readonly answer: () => void;
  /** "Choose together": Vidlun's words, already chosen, beside whatever was named. */
  readonly chooseTogether: () => void;
  /**
   * The transcript, fixed by the one person who knows what was said. Throws
   * the mishearing's analysis away and reads the corrected words instead.
   */
  readonly correctWording: (text: string) => void;
  /** Takes a word off the entry or puts it back, while choosing together. */
  readonly toggleKept: (id: string) => void;
  /** Adds a word typed while choosing together; never takes one away. */
  readonly addKept: (id: string) => void;
  /** From choosing together back to the question card, as it was. */
  readonly backToCard: () => void;
  readonly confirm: () => void;
  readonly backHome: () => void;
  readonly deleteEntry: (id: string) => void;
  readonly history: readonly HistoryDay[] | null;
  readonly openHistory: () => void;
  /** Leaves an open card for wherever it was opened from. */
  readonly closeEntry: () => void;
  readonly openEntry: (entry: MoodEntry) => void;
  readonly openSettings: () => void;
  readonly openSearch: () => void;
  readonly search: (query: string, emotionId: string | null) => void;
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
  readonly openVocabulary: () => void;
  /** Re-counts the vocabulary over a period the person picked. */
  readonly showPeriod: (period: { readonly from: Date; readonly to: Date }) => void;
  /** One week further back, and one week forward again. Never past this week. */
  readonly showEarlierWeek: () => void;
  readonly showLaterWeek: () => void;
}

const RECENT_LIMIT = 3;

/**
 * The capture path as one state machine. Every transition here is on the ten
 * second budget, so nothing in it asks the user a question it could answer.
 */
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
 * Only touches the draft that was waiting for it. By the time the sentence
 * lands the user may have edited the entry, confirmed it, or started another —
 * in every one of those cases the observation is stale and dropping it is
 * correct.
 */
function addObservation(current: CaptureStage, spoken: MoodEntry): CaptureStage {
  if (current.kind === 'turn' && current.draft !== null && current.draft.id === spoken.id) {
    return { ...current, draft: spoken };
  }

  if (current.kind !== 'reflecting' && current.kind !== 'comparing') {
    return current;
  }

  if (current.draft.id !== spoken.id || current.draft.wasRevisedByUser) {
    return current;
  }

  /*
   * The sentence arrives after the card, so it is folded into whatever the
   * card is holding rather than replacing it: the person may already have
   * adopted a word, and overwriting the draft would take it back.
   */
  return {
    ...current,
    proposed: spoken,
    draft: current.draft.withObservation(spoken.observation),
  };
}

/**
 * The words choosing together starts with: the person's own first, then
 * Vidlun's, all of them already chosen (owner's word, 2026-10-01) — four at
 * most, the entry's ceiling.
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
 * Whether the person took off any of Vidlun's words that choosing together
 * started them with. Those come already chosen, so taking one off is an act
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

/**
 * What the card holds once the answering is over.
 *
 * Someone who named the feeling and went on has given the entry: it is saved
 * as it stands, with no card in between (owner's word, 2026-09-30) — a hard
 * entry too, whose flag still brings the grounding offer on the saved screen.
 * What Vidlun heard is not thrown away; it stays on the draft as the
 * proposal, for the revision log and the granularity metric.
 *
 * Everyone else — someone who asked to choose together, or went on without a
 * word — gets Vidlun's words, already chosen beside their own. A hard entry
 * comes here too: with the person's answer no longer set beside Vidlun's,
 * there is no comparison left to spare it (owner's word, 2026-10-01).
 */
function cardAfterAnswer(card: TurnStage, proposed: MoodEntry, together: boolean): CaptureStage {
  const { chosen } = card;
  const mood = card.mood === null ? proposed.mood : MoodScore.of(card.mood);
  const contextTags = proposed.contextTags.filter((tag) => !card.droppedTopics.includes(tag));

  if (chosen.length > 0 && !together) {
    return {
      kind: 'saving',
      proposed,
      draft: MoodEntry.create({
        ...proposed.toProps(),
        selfEmotionIds: chosen,
        emotionIds: chosen,
        mood,
        contextTags,
      }),
    };
  }

  return {
    kind: 'comparing',
    proposed,
    draft: MoodEntry.create({
      ...proposed.toProps(),
      selfEmotionIds: chosen,
      emotionIds: wordsChosenTogether(chosen, proposed.emotionIds),
      mood,
      contextTags,
    }),
    card: { ...card, draft: proposed, holding: false, together: false },
  };
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
   * comparison needs it the instant the person answers. `TurnScreen` is given
   * only what the owner put on the card — the words near the reading, its
   * mood and its topics (2026-09-30, 2026-10-01) — and never the observation,
   * so what the card can display and what the stage knows stay two sets.
   */
  return current.holding ? cardAfterAnswer(current, draft, current.together) : { ...current, draft };
}

/**
 * Where the failure goes when the analysis does not arrive: onto the card it
 * was started for, as the words alone, for the person's answer to be the
 * whole entry. Any other card, or none, is left as it is — the failure
 * belongs to a question nobody is looking at any more.
 *
 * Exported for the test, like `whenAnalysisLands`.
 */
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
  /*
   * The take behind the draft on screen, held only until it is confirmed or
   * abandoned. Not on the entry: MoodEntry is about what someone felt, and a
   * path on disk is not that.
   */
  const takeUri = useRef<string | null>(null);
  /*
   * Echoes by entry id, and the entries saved while theirs was still being
   * written. A named answer is saved at once and the echo comes from a slower
   * model seconds later: it goes into the save when it is already here, and
   * into the stored entry when it lands after.
   */
  const echoes = useRef(new Map<string, string>());
  const awaitingEcho = useRef(new Set<string>());
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

  const reloadHome = useCallback(() => {
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
  }, [dependencies.getMonthSummary, getHomeView]);

  useEffect(reloadHome, [reloadHome]);

  useEffect(() => {
    // A year-old recording going a few days late harms nobody, so this runs on
    // open rather than on a schedule there would be no way to test.
    void dependencies.forgetOldRecordings.execute().catch(() => undefined);
  }, [dependencies.forgetOldRecordings]);

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

      notify({ kind: 'failed', message: describe(error) });
    },
    [notify],
  );

  /*
   * The card is already on screen. Vidlun's sentence comes from a slower model
   * and the entry needs it neither to render nor to save, so it is written in
   * afterwards rather than waited for — the difference between two seconds of
   * waiting and four.
   */
  const withObservation = useCallback(
    async (draft: MoodEntry) => {
      // Vidlun's remark is the model writing, and the model's writing is the
      // paid half. Not asked for rather than hidden: a sentence nobody may
      // read is a sentence not worth paying Sonnet for.
      if (!dependencies.hasNarrativeAccess) {
        return;
      }

      // A re-read keeps the entry's id; an echo about the old words is not it.
      echoes.current.delete(draft.id);

      try {
        const spoken = await dependencies.writeObservation.execute(draft);

        setStage((current) => addObservation(current, spoken));

        if (spoken.observation !== null) {
          echoes.current.set(spoken.id, spoken.observation);

          if (awaitingEcho.current.delete(spoken.id)) {
            const echoed = await dependencies.attachObservation.execute(
              spoken.id,
              spoken.observation,
            );

            // Home and an open page still hold the entry as it was saved.
            if (echoed !== null) {
              setStage((current) =>
                current.kind === 'detail' && current.entry.id === echoed.id
                  ? { ...current, entry: echoed }
                  : current,
              );
              reloadHome();
            }
          }
        }
      } catch {
        // The entry is complete without it. Failing here must not take down a
        // card the user is already reading.
      }
    },
    [
      dependencies.attachObservation,
      dependencies.hasNarrativeAccess,
      dependencies.writeObservation,
      reloadHome,
    ],
  );

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
   * How this card's words become a draft, kept so a corrected transcript can
   * be re-read the same way the original was — voice stays voice and typed
   * stays typed without the stage having to know which it is holding.
   */
  const rebuild = useRef<{
    readonly heard: (words: Spoken) => Promise<MoodEntry>;
    readonly unheard: (words: Spoken) => MoodEntry;
  } | null>(null);

  /*
   * Saves what the person said and named while Vidlun could not listen. The
   * entry is theirs in full — their words, their transcript — and Vidlun's
   * answer is owed rather than lost: the id is kept for HearUnheardEntries,
   * which fills it in the next time the network is there.
   */
  const saveUnheard = useCallback(
    (draft: MoodEntry, chosen: readonly string[], spoken: Spoken, mood: number | null) => {
      const confirmed = MoodEntry.create({
        ...draft.toProps(),
        selfEmotionIds: chosen,
        emotionIds: chosen,
        proposedEmotionIds: [],
        mood: mood === null ? draft.mood : MoodScore.of(mood),
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
          takeUri.current = null;

          const refreshed = await dependencies.getHomeView.execute(RECENT_LIMIT);

          setHome(refreshed);
          setStage({
            kind: 'saved',
            streakDays: refreshed.streakDays,
            offersGrounding: false,
            unheard: true,
          });
        })
        .catch((error: unknown) => {
          // The words and the answer are still in hand: the card comes back
          // as it stood, for one more tap on "next".
          fail(error, {
            kind: 'turn',
            spoken,
            chosen,
            draft,
            holding: false,
            unheard: true,
            together: false,
            mood,
            droppedTopics: [],
          });
        });
    },
    [dependencies, fail],
  );

  const ask = useCallback(
    (
      spoken: Spoken,
      build: (words: Spoken) => Promise<MoodEntry>,
      unheard: (words: Spoken) => MoodEntry,
    ) => {
      rebuild.current = { heard: build, unheard };

      /*
       * Always asked: the question is no longer a setting (owner's word,
       * 2026-10-01). Every entry opens on the words nearest to what was
       * said, to choose from or to answer with one's own.
       */
      setStage({
        kind: 'turn',
        spoken,
        chosen: [],
        draft: null,
        holding: false,
        unheard: false,
        together: false,
        mood: null,
        droppedTopics: [],
      });

      build(spoken)
        .then((draft) => {
          setStage((current) => whenAnalysisLands(current, draft, spoken.text));

          void withObservation(draft);
        })
        .catch(() => {
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
    [notify, saveUnheard, withObservation],
  );

  /*
   * The person answered first and Vidlun failed second: the moment the
   * failure lands on a card already being held, the answer is saved as it
   * stands.
   */
  useEffect(() => {
    if (stage.kind === 'turn' && stage.unheard && stage.holding && stage.draft !== null) {
      saveUnheard(stage.draft, stage.chosen, stage.spoken, stage.mood);
    }
  }, [saveUnheard, stage]);

  /**
   * Yesterday evening, while the person fills the day they missed; null the
   * rest of the time. Nine o'clock, because the entry speaks for the whole
   * day and the evening is where days get summed up.
   */
  const backfillAt = useRef<Date | null>(null);

  const record = useCallback(() => {
    // Not awaited, and its failure is not ours: the take must start now, and
    // an unopened model only means the transcription pays for it later.
    void dependencies.transcribeTake.prepare();

    dependencies.recorder
      .start()
      .then(async (take) => {
        // Fires for a tap and for the ceiling alike: the person may not be looking.
        dependencies.haptics.settle();

        takeUri.current = take.uri;
        setStage({ kind: 'processing' });

        const spoken = await dependencies.transcribeTake.execute(take);

        ask(
          spoken,
          (words) => dependencies.createVoiceEntry.execute(words, backfillAt.current ?? undefined),
          (words) =>
            dependencies.createUnheardEntry.execute(words, 'voice', backfillAt.current ?? undefined),
        );
      })
      .catch((error: unknown) => {
        fail(error, { kind: 'idle' });
      });
  }, [ask, dependencies, fail]);

  const startRecording = useCallback(() => {
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
        takeUri.current = waiting.recording.uri;
        setParked(null);

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
          (words) => dependencies.createVoiceEntry.execute(words, waiting.recordedAt),
          (words) => dependencies.createUnheardEntry.execute(words, 'voice', waiting.recordedAt),
        );
      })
      .catch((error: unknown) => {
        reloadParked();
        fail(error, { kind: 'idle' });
      });
  }, [ask, dependencies, fail, reloadParked]);

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
          const [themes, patterns, earlier] = await Promise.all([
            dependencies.getWeekThemes.execute({
              weekStart: week.weekStart,
              weekEnd: week.weekEnd,
            }),
            // Over the month, as the drawing has it: a week rarely holds
            // enough of anything for a comparison worth printing.
            dependencies.findMoodPatterns.execute({ containing: week.weekStart }),
            /*
             * Whether the step back leads anywhere. Asked rather than assumed,
             * because a live arrow into a week that never existed reads as a
             * week the person failed to fill.
             */
            dependencies.getWeekSummary.execute({
              containing: weeksAgo(dependencies.clock.now(), weeksBack + 1),
            }),
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
                    hasEarlierWeek: earlier.entryCount > 0,
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

  const openSubscription = useCallback(() => {
    setStage({ kind: 'subscription', plans: [], outcome: null });

    // Asked for every time the screen opens: prices move, and a price
    // remembered from last week is a price we would be quoting wrongly.
    void dependencies.purchases
      .plans()
      .then((plans) => {
        setStage((current) => (current.kind === 'subscription' ? { ...current, plans } : current));
      })
      .catch(fail);
  }, [dependencies.purchases, fail]);

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

      setStage({ kind: 'month', month: null, from });

      void dependencies.getMonthSummary
        .execute({ withNarrative: false, month })
        .then(async (shape) => {
          setStage((current) => (current.kind === 'month' ? { ...current, month: shape } : current));

          const written = await dependencies.getMonthSummary.execute({ withNarrative: true, month });

          setStage((current) => (current.kind === 'month' ? { ...current, month: written } : current));
        })
        .catch((error: unknown) => {
          // From the list the page stays, its back arrow intact; from home it closes.
          fail(error, from === 'idle' ? { kind: 'idle' } : undefined);
        });
    },
    [dependencies.getMonthSummary, dependencies.hasNarrativeAccess, fail, openSubscription],
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

  const runSearch = useCallback(
    (query: string, emotionId: string | null) => {
      // The typed text lands immediately and the results follow, so the field
      // never lags behind the keyboard.
      setStage({ kind: 'search', query, emotionId, result: null });

      void dependencies.searchEntries
        .execute({ query, emotionId })
        .then((result) => {
          setStage((current) =>
            current.kind === 'search' && current.query === query && current.emotionId === emotionId
              ? { ...current, result }
              : current,
          );
        })
        .catch(fail);
    },
    [dependencies.searchEntries, fail],
  );

  const loadVocabulary = useCallback(
    (period?: { readonly from: Date; readonly to: Date }) => {
      setStage((current) =>
        current.kind === 'vocabulary'
          ? { ...current, growth: null }
          : { kind: 'vocabulary', growth: null, earliest: null },
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
            current.kind === 'vocabulary' ? { ...current, growth, earliest: oldest } : current,
          );
        })
        .catch(fail);
    },
    [dependencies.getHistory, dependencies.getVocabularyGrowth, fail],
  );

  const save = useCallback(
    (proposed: MoodEntry, draft: MoodEntry, backTo: CaptureStage, declined = false) => {
      setStage({ kind: 'processing' });

      // An echo that came in while the card was up goes in with the entry.
      const echo = echoes.current.get(draft.id);
      const confirmed =
        draft.observation === null && echo !== undefined && !draft.wasRevisedByUser
          ? draft.withObservation(echo)
          : draft;

      dependencies.confirmEntry
        .execute({
          proposed,
          confirmed,
          recordingUri: dependencies.keepRecordings ? (takeUri.current ?? undefined) : undefined,
          keptOwnWords: declined,
        })
        .then(async () => {
          dependencies.haptics.success();

          takeUri.current = null;

          // Still on its way: written into the stored entry when it lands.
          if (confirmed.observation === null && dependencies.hasNarrativeAccess) {
            const landed = echoes.current.get(confirmed.id);

            if (landed === undefined) {
              awaitingEcho.current.add(confirmed.id);
            } else {
              await dependencies.attachObservation.execute(confirmed.id, landed).catch(() => undefined);
            }
          }

          const refreshed = await dependencies.getHomeView.execute(RECENT_LIMIT);

          setHome(refreshed);
          setStage({
            kind: 'saved',
            streakDays: refreshed.streakDays,
            offersGrounding: confirmed.safetyFlag === 'distress',
            unheard: false,
          });
        })
        .catch((error: unknown) => {
          // Nothing was written; the card comes back with the draft as it stood.
          fail(error, backTo);
        });
    },
    [dependencies, fail],
  );

  const confirm = useCallback(() => {
    if (stage.kind !== 'reflecting' && stage.kind !== 'comparing') {
      return;
    }

    save(
      stage.proposed,
      stage.draft,
      stage,
      stage.kind === 'comparing' && declinedVidlunsWords(stage.proposed, stage.draft),
    );
  }, [save, stage]);

  /*
   * The answer that needs no card. If the save fails, the plain card comes
   * up with the draft, so saving is one tap away from trying again.
   */
  useEffect(() => {
    if (stage.kind === 'saving') {
      save(stage.proposed, stage.draft, {
        kind: 'reflecting',
        proposed: stage.proposed,
        draft: stage.draft,
      });
    }
  }, [save, stage]);

  return {
    stage,
    notice,
    dismissNotice: useCallback(() => {
      setNotice(null);
    }, []),
    monthCard,
    home,
    reloadHome,
    hearUnheard,
    startRecording,
    stopRecording: useCallback(() => {
      dependencies.recorder.stop();
    }, [dependencies.recorder]),
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
      backfillAt.current = null;
      setStage({ kind: 'writing' });
    }, []),
    startYesterday: useCallback(() => {
      const now = dependencies.clock.now();

      backfillAt.current = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 21, 0);
      setStage({ kind: 'writing' });
    }, [dependencies.clock]),
    submitText: useCallback(
      (text: string) => {
        takeUri.current = null;
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
    history,
    openEntry: useCallback(
      (entry: MoodEntry) => {
        setStage((current) => ({
          kind: 'detail',
          entry,
          recordingUri: null,
          from: current.kind === 'history' ? 'history' : 'idle',
        }));

        void dependencies.findRecording
          .execute(entry.id)
          .then((uri) => {
            // Only if the same entry is still open: the lookup is quick, but
            // quick is not instant and people tap on.
            setStage((current) =>
              current.kind === 'detail' && current.entry.id === entry.id
                ? { ...current, recordingUri: uri }
                : current,
            );
          })
          .catch(() => undefined);
      },
      [dependencies.findRecording],
    ),
    closeEntry: useCallback(() => {
      setStage((current) => (current.kind === 'detail' ? { kind: current.from } : current));
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
    refineOwnWord: useCallback((parentId: string, childId: string) => {
      setStage((current) => {
        if (current.kind !== 'turn' || !current.chosen.includes(parentId)) {
          return current;
        }

        /*
         * In place, so the more exact word inherits the position the broad one
         * held rather than arriving at the end of the row. Filtered afterwards
         * because the child may already be there — refining twice into the same
         * word is one word, not two.
         */
        const replaced = current.chosen.map((each) => (each === parentId ? childId : each));
        const chosen = replaced.filter((each, at) => replaced.indexOf(each) === at);

        return { ...current, chosen };
      });
    }, []),
    setMood: useCallback((value: number) => {
      setStage((current) => (current.kind === 'turn' ? { ...current, mood: value } : current));
    }, []),
    toggleTopic: useCallback((tag: string) => {
      setStage((current) => {
        if (current.kind !== 'turn') {
          return current;
        }

        const dropped = current.droppedTopics;

        return {
          ...current,
          droppedTopics: dropped.includes(tag)
            ? dropped.filter((each) => each !== tag)
            : [...dropped, tag],
        };
      });
    }, []),
    answer: useCallback(() => {
      // Vidlun could not listen: nothing to compare against, and nothing
      // coming. The answer given is the whole entry.
      if (stage.kind === 'turn' && stage.unheard && stage.draft !== null) {
        saveUnheard(stage.draft, stage.chosen, stage.spoken, stage.mood);

        return;
      }

      setStage((current) => {
        if (current.kind !== 'turn') {
          return current;
        }

        // Nothing to compare against yet: hold, and the analysis will carry
        // the card forward the moment it lands.
        return current.draft === null
          ? { ...current, holding: true }
          : cardAfterAnswer(current, current.draft, false);
      });
    }, [saveUnheard, stage]),
    chooseTogether: useCallback(() => {
      // Vidlun could not listen: there is nothing to choose together with,
      // and what was named so far is the whole entry.
      if (stage.kind === 'turn' && stage.unheard && stage.draft !== null) {
        saveUnheard(stage.draft, stage.chosen, stage.spoken, stage.mood);

        return;
      }

      setStage((current) => {
        if (current.kind !== 'turn') {
          return current;
        }

        // Their words so far are kept: choosing together is not the same as
        // having no answer, and what they named before seeing Vidlun's is
        // still the unaided measurement.
        return current.draft === null
          ? { ...current, holding: true, together: true }
          : cardAfterAnswer(current, current.draft, true);
      });
    }, [saveUnheard, stage]),
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
        setStage({ ...stage, spoken, draft: null, unheard: false });

        builders
          .heard(spoken)
          .then((draft) => {
            setStage((current) => whenAnalysisLands(current, draft, corrected));

            void withObservation(draft);
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
      [notify, stage, withObservation],
    ),
    toggleKept: useCallback((id: string) => {
      setStage((current) => {
        if (current.kind !== 'comparing') {
          return current;
        }

        const kept = current.draft.emotionIds;

        if (kept.includes(id)) {
          return { ...current, draft: current.draft.withEmotionIds(kept.filter((each) => each !== id)) };
        }

        // Taking a word off is what frees a slot under the four-word ceiling.
        return kept.length >= MoodEntry.MAX_EMOTIONS
          ? current
          : { ...current, draft: current.draft.withEmotionIds([...kept, id]) };
      });
    }, []),
    addKept: useCallback((id: string) => {
      setStage((current) =>
        current.kind !== 'comparing' ||
        current.draft.emotionIds.includes(id) ||
        current.draft.emotionIds.length >= MoodEntry.MAX_EMOTIONS
          ? current
          : { ...current, draft: current.draft.withEmotionIds([...current.draft.emotionIds, id]) },
      );
    }, []),
    backToCard: useCallback(() => {
      // The card as it was, with the reading — and any echo since — in hand.
      setStage((current) =>
        current.kind === 'comparing' ? { ...current.card, draft: current.proposed } : current,
      );
    }, []),
    openSettings: useCallback(() => {
      setStage({ kind: 'settings' });
    }, []),
    openSearch: useCallback(() => {
      runSearch('', null);
    }, [runSearch]),
    search: runSearch,
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
      if (stage.kind === 'month' && stage.from === 'months') {
        openMonths();

        return;
      }

      setStage({ kind: 'idle' });
      reloadHome();
    }, [openMonths, reloadHome, stage]),
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
      if (stage.kind === 'stats') {
        loadStats(stage.weeksBack + 1);
      }
    }, [loadStats, stage]),
    showLaterWeek: useCallback(() => {
      // Never forward past this week: there is nothing there yet, and an
      // empty week you navigated into reads as one you failed to fill.
      if (stage.kind === 'stats' && stage.weeksBack > 0) {
        loadStats(stage.weeksBack - 1);
      }
    }, [loadStats, stage]),
    openHistory: useCallback(() => {
      setStage({ kind: 'history' });
      void dependencies.getHistory.execute().then(setHistory).catch(fail);
    }, [dependencies.getHistory, fail]),
    deleteEntry: useCallback(
      (id: string) => {
        // Reloading rather than dropping the row locally: the streak is
        // counted from what is stored, and it may have just changed. History
        // is refreshed too, since the row may have been deleted from there.
        void dependencies.deleteEntry
          .execute(id)
          .then(async () => {
            // Standing on a card that no longer exists is the one thing the
            // delete must not leave behind. Back to wherever it was opened
            // from — and only for that card, since a row swiped away in a list
            // should leave the list where it is.
            setStage((current) =>
              current.kind === 'detail' && current.entry.id === id
                ? { kind: current.from }
                : current,
            );
            reloadHome();
            setHistory(await dependencies.getHistory.execute());
          })
          .catch(fail);
      },
      [dependencies.deleteEntry, dependencies.getHistory, reloadHome, fail],
    ),
  };
}
