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
import type { ReviseEntry } from '@/application/use-cases/ReviseEntry';
import type { WriteObservation } from '@/application/use-cases/WriteObservation';
import { MoodEntry, type EntryEdits } from '@/domain/entities/MoodEntry';
import type { LegalDocumentKind } from '@/i18n/legal';
import type { GetMonthSummary } from '@/application/use-cases/GetMonthSummary';
import type { StatsView } from '@/presentation/screens/StatsScreen';
import { RecordingCancelledError } from '@/domain/errors/RecordingErrors';
import { Confidence } from '@/domain/value-objects/Confidence';
import type { IAudioRecorder } from '@/domain/ports/IAudioRecorder';
import type { IClock } from '@/domain/ports/IClock';
import type { IPurchases, Plan, PurchaseOutcome } from '@/domain/ports/IPurchases';
import type { IHaptics } from '@/domain/ports/IHaptics';

export type CaptureStage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'recording' }
  | { readonly kind: 'writing' }
  | { readonly kind: 'processing' }
  /**
   * The card, asking before it answers. One stage rather than two screens: the
   * question and the hold are the same card in two states, and a person who
   * answers slower than the model never sees the second one.
   */
  | {
      readonly kind: 'turn';
      readonly spoken: Spoken;
      /** What the person has named so far. Empty is an answer, not a blank. */
      readonly chosen: readonly string[];
      /** Null until the analysis lands behind the question. */
      readonly draft: MoodEntry | null;
      /** True once they have answered and are waiting on the analysis. */
      readonly holding: boolean;
    }
  | {
      readonly kind: 'comparing';
      readonly proposed: MoodEntry;
      readonly draft: MoodEntry;
    }
  | { readonly kind: 'reflecting'; readonly proposed: MoodEntry; readonly draft: MoodEntry }
  | { readonly kind: 'editing'; readonly proposed: MoodEntry; readonly draft: MoodEntry }
  | {
      readonly kind: 'saved';
      readonly streakDays: number;
      /**
       * True when the entry sounded overwhelmed — distress, never crisis —
       * and the saved screen offers a minute of grounding. The drawing gates
       * it the same way: `hard && !crisis`.
       */
      readonly offersGrounding: boolean;
    }
  /** The grounding exercise. Keeps nothing, and must never learn to. */
  | { readonly kind: 'grounding' }
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
    }
  | { readonly kind: 'failed'; readonly message: string };

export interface CaptureDependencies {
  readonly recorder: IAudioRecorder;
  readonly haptics: IHaptics;
  readonly transcribeTake: TranscribeTake;
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly createTextEntry: CreateTextEntry;
  readonly confirmEntry: ConfirmEntry;
  readonly reviseEntry: ReviseEntry;
  readonly writeObservation: WriteObservation;
  readonly deleteEntry: DeleteEntry;
  readonly getHistory: GetHistory;
  readonly forgetOldRecordings: ForgetOldRecordings;
  readonly findRecording: FindRecording;
  /** False stops a confirmed take from being kept at all. */
  readonly keepRecordings: boolean;
  /**
   * False takes the question out of the capture path entirely: the card is
   * what it was before §3b, and it costs what it cost then.
   */
  readonly asksFirst: boolean;
  readonly getHomeView: GetHomeView;
  readonly getWeekSummary: GetWeekSummary;
  readonly getMonthSummary: GetMonthSummary;
  readonly getWeekThemes: GetWeekThemes;
  readonly findMoodPatterns: FindMoodPatterns;
  readonly searchEntries: SearchEntries;
  readonly getVocabularyGrowth: GetVocabularyGrowth;
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
  readonly home: HomeView | null;
  /** Re-reads the home view; the splash's retry when opening the journal hangs. */
  readonly reloadHome: () => void;
  /** The month being offered on home's first-days card, or null off-season. */
  readonly monthCard: Date | null;
  readonly startRecording: () => void;
  readonly stopRecording: () => void;
  readonly cancel: () => void;
  readonly startWriting: () => void;
  /** Opens the text screen aimed at yesterday evening — the missed day's door. */
  readonly startYesterday: () => void;
  readonly submitText: (text: string) => void;
  readonly beginEditing: () => void;
  /** Adds or removes one of the person's own words while the card is asking. */
  readonly toggleOwnWord: (id: string) => void;
  /** Trades one of their words for a more exact child of it. */
  readonly refineOwnWord: (parentId: string, childId: string) => void;
  /** Done answering. Goes on to the comparison, or waits for it. */
  readonly answer: () => void;
  /** "I don't know, show me" — no answer given, and none invented. */
  readonly skipAnswer: () => void;
  /**
   * The transcript, fixed by the one person who knows what was said. Throws
   * the mishearing's analysis away and reads the corrected words instead.
   */
  readonly correctWording: (text: string) => void;
  /** Takes one of Vidlun's words into the entry. */
  readonly adopt: (id: string) => void;
  /**
   * Takes a word back out — their own or an adopted one alike. The drawing
   * makes every kept chip removable, which is also what frees a slot when the
   * four-word ceiling stops another adoption.
   */
  readonly unkeep: (id: string) => void;
  /** Declines the rest of them, and says so out loud rather than by silence. */
  readonly keepMine: () => void;
  readonly keptMine: boolean;
  readonly applyEdits: (edits: EntryEdits) => void;
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
  readonly startGrounding: () => void;
  readonly subscribe: (planId: string) => void;
  readonly restorePurchase: () => void;
  readonly dismissPurchaseOutcome: () => void;
  readonly openStats: () => void;
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
    kind: current.kind,
    proposed: spoken,
    draft: current.draft.withObservation(spoken.observation),
  };
}

/**
 * What the card holds once the answering is over.
 *
 * The kept set starts as the person's own words. When they named nothing, it
 * starts as Vidlun's instead — an unanswered question is the card as it was
 * before any of this, and throwing a good analysis away because someone had no
 * word to hand would be the opposite of helping.
 */
function comparisonOf(proposed: MoodEntry, chosen: readonly string[]): CaptureStage {
  const draft = MoodEntry.create({
    ...proposed.toProps(),
    selfEmotionIds: chosen,
    emotionIds: chosen.length > 0 ? chosen : proposed.emotionIds,
  });

  /*
   * A hard entry gets the plain card, never the comparison. Setting somebody's
   * answer beside Vidlun's and naming the difference is a thing to do with an
   * ordinary day; on a difficult one it is the app making a lesson out of what
   * someone just said.
   *
   * The question itself has already been asked by this point — the flag is not
   * known until the analysis returns, and by then the card is on screen. That
   * is the part of §M8's rule this flow cannot honour, and one quiet question
   * with a way out of it is the mildest version of asking.
   */
  if (proposed.safetyFlag !== 'none') {
    return { kind: 'reflecting', proposed, draft };
  }

  return { kind: 'comparing', proposed, draft };
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
  asking: boolean,
  /** The transcript this analysis was started for; absent means any. */
  forText?: string,
): CaptureStage {
  /*
   * With the question switched off there is nothing to hold the card back for,
   * so the analysis lands on the card directly — the flow as it was before
   * §3b, at the speed it was.
   */
  if (!asking) {
    return current.kind === 'processing' ? { kind: 'reflecting', proposed: draft, draft } : current;
  }

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
   * Held, not shown. The draft is carried on the stage because the comparison
   * needs it the instant the person answers, and `TurnScreen` is given the
   * transcript and their own words and nothing else — so what the card can
   * display and what the stage knows are two different sets on purpose.
   */
  return current.holding ? comparisonOf(draft, current.chosen) : { ...current, draft };
}

export function useCaptureFlow(dependencies: CaptureDependencies): CaptureFlow {
  const [stage, setStage] = useState<CaptureStage>({ kind: 'idle' });
  const [home, setHome] = useState<HomeView | null>(null);
  const [monthCard, setMonthCard] = useState<Date | null>(null);
  const [history, setHistory] = useState<readonly HistoryDay[] | null>(null);
  /** Whether the person has declined Vidlun's remaining words on this card. */
  const [keptMine, setKeptMine] = useState(false);
  /*
   * The take behind the draft on screen, held only until it is confirmed or
   * abandoned. Not on the entry: MoodEntry is about what someone felt, and a
   * path on disk is not that.
   */
  const takeUri = useRef<string | null>(null);

  const { getHomeView } = dependencies;

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

  const fail = useCallback((error: unknown) => {
    if (error instanceof RecordingCancelledError) {
      setStage({ kind: 'idle' });

      return;
    }

    setStage({ kind: 'failed', message: describe(error) });
  }, []);

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

      try {
        const spoken = await dependencies.writeObservation.execute(draft);

        setStage((current) => addObservation(current, spoken));
      } catch {
        // The entry is complete without it. Failing here must not take down a
        // card the user is already reading.
      }
    },
    [dependencies.hasNarrativeAccess, dependencies.writeObservation],
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
  const rebuild = useRef<((words: Spoken) => Promise<MoodEntry>) | null>(null);

  const ask = useCallback(
    (spoken: Spoken, build: (words: Spoken) => Promise<MoodEntry>) => {
      // Per card, not per session. Left standing it would put the last entry's
      // refusal on this one's label, and now that it is logged, in its record.
      setKeptMine(false);
      rebuild.current = build;

      const asking = dependencies.asksFirst;

      setStage(
        asking
          ? { kind: 'turn', spoken, chosen: [], draft: null, holding: false }
          : { kind: 'processing' },
      );

      build(spoken)
        .then((draft) => {
          setStage((current) => whenAnalysisLands(current, draft, asking, spoken.text));

          void withObservation(draft);
        })
        .catch(fail);
    },
    [dependencies.asksFirst, fail, withObservation],
  );

  /**
   * Yesterday evening, while the person fills the day they missed; null the
   * rest of the time. Nine o'clock, because the entry speaks for the whole
   * day and the evening is where days get summed up.
   */
  const backfillAt = useRef<Date | null>(null);

  const startRecording = useCallback(() => {
    backfillAt.current = null;
    dependencies.haptics.tap();
    setStage({ kind: 'recording' });

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

        ask(spoken, (words) =>
          dependencies.createVoiceEntry.execute(words, backfillAt.current ?? undefined),
        );
      })
      .catch(fail);
  }, [ask, dependencies, fail]);

  /**
   * The week and its themes. The vocabulary is a separate screen and a
   * separate read, so opening the week no longer pays for a month of history
   * nobody asked to see.
   */
  const loadStats = useCallback(
    (weeksBack: number) => {
      setStage({ kind: 'stats', weeksBack, view: null });

      const containing = weeksAgo(dependencies.clock.now(), weeksBack);

      const monthIsFresh = weeksBack === 0 && dependencies.getMonthSummary.isFresh();

      void dependencies.getWeekSummary
        /*
         * Without the narrative first: everything else on the screen is read
         * off the phone in milliseconds, and the narrative is a model call
         * that was making the whole screen blank for seconds. It is written
         * in below once it exists — and only for someone who can read it,
         * since the AI-written week is the paid half of the product.
         */
        .execute({ withNarrative: false, containing })
        .then(async (week) => {
          const [themes, patterns, earlier, month] = await Promise.all([
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
              withNarrative: false,
              containing: weeksAgo(dependencies.clock.now(), weeksBack + 1),
            }),
            monthIsFresh
              ? dependencies.getMonthSummary.execute({ withNarrative: false })
              : Promise.resolve(null),
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
                    month: month !== null && month.hasEnough ? month : null,
                    hasEarlierWeek: earlier.entryCount > 0,
                    hasNarrativeAccess: dependencies.hasNarrativeAccess,
                  },
                }
              : current,
          );

          if (dependencies.hasNarrativeAccess) {
            const [withProse, monthProse] = await Promise.all([
              dependencies.getWeekSummary.execute({ withNarrative: true, containing }),
              monthIsFresh && month !== null && month.hasEnough
                ? dependencies.getMonthSummary.execute({ withNarrative: true })
                : Promise.resolve(null),
            ]);

            setStage((current) =>
              current.kind === 'stats' && current.weeksBack === weeksBack && current.view !== null
                ? {
                    ...current,
                    view: {
                      ...current.view,
                      week: withProse,
                      month: monthProse ?? current.view.month,
                    },
                  }
                : current,
            );
          }
        })
        .catch(fail);
    },
    [dependencies, fail],
  );

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

  const confirm = useCallback(() => {
    if (stage.kind !== 'reflecting' && stage.kind !== 'editing' && stage.kind !== 'comparing') {
      return;
    }

    const { proposed, draft } = stage;

    setStage({ kind: 'processing' });

    dependencies.confirmEntry
      .execute({
        proposed,
        confirmed: draft,
        recordingUri: dependencies.keepRecordings ? (takeUri.current ?? undefined) : undefined,
        keptOwnWords: keptMine,
      })
      .then(async () => {
        dependencies.haptics.success();

        takeUri.current = null;

        const refreshed = await dependencies.getHomeView.execute(RECENT_LIMIT);

        setHome(refreshed);
        setStage({
          kind: 'saved',
          streakDays: refreshed.streakDays,
          offersGrounding: draft.safetyFlag === 'distress',
        });
      })
      .catch(fail);
  }, [dependencies, fail, keptMine, stage]);

  return {
    stage,
    monthCard,
    home,
    reloadHome,
    startRecording,
    stopRecording: useCallback(() => {
      dependencies.recorder.stop();
    }, [dependencies.recorder]),
    cancel: useCallback(() => {
      dependencies.recorder.cancel();
      setStage({ kind: 'idle' });
    }, [dependencies.recorder]),
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
        ask({ text: text.trim(), confidence: Confidence.of(1) }, (words) =>
          dependencies.createTextEntry.execute(words.text, backfillAt.current ?? undefined),
        );
      },
      [ask, dependencies.createTextEntry],
    ),
    beginEditing: useCallback(() => {
      setStage((current) =>
        current.kind === 'reflecting' || current.kind === 'comparing'
          ? { kind: 'editing', proposed: current.proposed, draft: current.draft }
          : current,
      );
    }, []),
    applyEdits: useCallback(
      (edits: EntryEdits) => {
        setStage((current) => {
          if (current.kind !== 'editing') {
            return current;
          }

          return {
            kind: 'reflecting',
            proposed: current.proposed,
            draft: dependencies.reviseEntry.execute(current.draft, edits),
          };
        });
      },
      [dependencies.reviseEntry],
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
    answer: useCallback(() => {
      setStage((current) => {
        if (current.kind !== 'turn') {
          return current;
        }

        // Nothing to compare against yet: hold, and the analysis will carry
        // the card forward the moment it lands.
        return current.draft === null
          ? { ...current, holding: true }
          : comparisonOf(current.draft, current.chosen);
      });
    }, []),
    skipAnswer: useCallback(() => {
      setStage((current) => {
        if (current.kind !== 'turn') {
          return current;
        }

        // "Show me" is not an answer, so none is recorded — the empty set here
        // means they chose not to, and the card holds Vidlun's words instead.
        return current.draft === null
          ? { ...current, chosen: [], holding: true }
          : comparisonOf(current.draft, []);
      });
    }, []),
    correctWording: useCallback(
      (text: string) => {
        const corrected = text.trim();

        if (
          stage.kind !== 'turn' ||
          rebuild.current === null ||
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

        // The draft in hand was read off the mishearing; none of it survives.
        // Their own named words do — the feeling never depended on the typo.
        setStage({ ...stage, spoken, draft: null });

        rebuild
          .current(spoken)
          .then((draft) => {
            setStage((current) => whenAnalysisLands(current, draft, true, corrected));

            void withObservation(draft);
          })
          .catch(fail);
      },
      [fail, stage, withObservation],
    ),
    unkeep: useCallback((id: string) => {
      setStage((current) => {
        if (current.kind !== 'comparing' || !current.draft.emotionIds.includes(id)) {
          return current;
        }

        return {
          ...current,
          draft: current.draft.withEmotionIds(
            current.draft.emotionIds.filter((each) => each !== id),
          ),
        };
      });
    }, []),
    adopt: useCallback((id: string) => {
      setStage((current) => {
        if (current.kind !== 'comparing' || current.draft.emotionIds.includes(id)) {
          return current;
        }

        const emotionIds = [...current.draft.emotionIds, id].slice(0, MoodEntry.MAX_EMOTIONS);

        return { ...current, draft: current.draft.withEmotionIds(emotionIds) };
      });
      setKeptMine(false);
    }, []),
    keepMine: useCallback(() => {
      /*
       * Recorded rather than inferred from doing nothing. A person who keeps
       * their own word is telling us something — either the model was wrong or
       * they know themselves better than it does — and both are worth more than
       * an absence of taps.
       */
      setKeptMine(true);
    }, []),
    keptMine,
    openSettings: useCallback(() => {
      setStage({ kind: 'settings' });
      // The profile counts entries, and the count comes from the journal it
      // shares with the feed rather than from a second reading of the same
      // rows.
      void dependencies.getHistory
        .execute()
        .then(setHistory)
        .catch(fail);
    }, [dependencies.getHistory, fail]),
    openSearch: useCallback(() => {
      runSearch('', null);
    }, [runSearch]),
    search: runSearch,
    openSubscription: useCallback(() => {
      setStage({ kind: 'subscription', plans: [], outcome: null });

      // Asked for every time the screen opens: prices move, and a price
      // remembered from last week is a price we would be quoting wrongly.
      void dependencies.purchases
        .plans()
        .then((plans) => {
          setStage((current) =>
            current.kind === 'subscription' ? { ...current, plans } : current,
          );
        })
        .catch(fail);
    }, [dependencies.purchases, fail]),
    openLegal: useCallback((doc: LegalDocumentKind) => {
      setStage({ kind: 'legal', doc });
    }, []),
    startGrounding: useCallback(() => {
      setStage({ kind: 'grounding' });
    }, []),
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
    showEarlierWeek: useCallback(() => {
      setStage((current) => {
        if (current.kind === 'stats') {
          loadStats(current.weeksBack + 1);
        }

        return current;
      });
    }, [loadStats]),
    showLaterWeek: useCallback(() => {
      setStage((current) => {
        // Never forward past this week: there is nothing there yet, and an
        // empty week you navigated into reads as one you failed to fill.
        if (current.kind === 'stats' && current.weeksBack > 0) {
          loadStats(current.weeksBack - 1);
        }

        return current;
      });
    }, [loadStats]),
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
