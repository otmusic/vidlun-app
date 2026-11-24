import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { affirmationFrequencyFor, readsInFull, type Entitlement } from '@/domain/entities/Entitlement';
import type { LockMethod } from '@/domain/ports/IScreenLock';
import type { Settings } from '@/domain/ports/ISettings';
import type { StoreRelease } from '@/domain/ports/IStoreListing';
import type { Locale, Translate } from '@/i18n';
import { legalDocument } from '@/i18n/legal';

import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, View, useWindowDimensions } from 'react-native';

import { wordsOffered, wordsWithoutReading } from '../components/emotionTone';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { MilestoneSheet } from '../components/MilestoneSheet';
import { TabBar, type Tab } from '../components/TabBar';
import { Toast, type ToastLine } from '../components/Toast';
import { UndoToast } from '../components/UndoToast';
import type { CaptureFlow, CaptureStage, Notice } from '../hooks/useCaptureFlow';
import { SwipeBack } from '../components/SwipeBack';
import { EntryDetailScreen } from './EntryDetailScreen';
import { nextStack, screenKeyOf } from './screenStack';
import { useTheme } from '../theme/ThemeProvider';
import { HistoryScreen } from './HistoryScreen';
import { HomeScreen } from './HomeScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ParkedScreen } from './ParkedScreen';
import { CardFeelingsScreen } from './CardFeelingsScreen';
import { CardMoodScreen } from './CardMoodScreen';
import { CardWordsScreen } from './CardWordsScreen';
import { RecordingScreen } from './RecordingScreen';
import { ReflectionScreen } from './ReflectionScreen';
import { AffirmationScreen, affirmationCaption } from './AffirmationScreen';
import { AffirmationBloom, type BloomOrigin } from './AffirmationBloom';
import { charmOf, type Charm } from '../components/AffirmationCharm';
import type { KeptAffirmation } from '@/domain/entities/KeptAffirmation';
import { GroundingScreen } from './GroundingScreen';
import { SavedScreen } from './SavedScreen';
import { ProfileScreen, type BackupProgress } from './ProfileScreen';
import { LegalScreen } from './LegalScreen';
import { SubscriptionScreen } from './SubscriptionScreen';
import { StatsScreen } from './StatsScreen';
import { MonthScreen } from './MonthScreen';
import { MonthsScreen } from './MonthsScreen';
import { VocabularyScreen } from './VocabularyScreen';
import { TextEntryScreen } from './TextEntryScreen';

export interface CaptureFlowScreenProps {
  readonly flow: CaptureFlow;
  readonly vocabulary: EmotionVocabulary;
  readonly settings: Settings;
  readonly onSettingsChange: (settings: Settings) => void;
  readonly locale: Locale;
  readonly today: Date;
  readonly t: Translate;
  /** What the store says is owned; null until it has answered. */
  readonly entitlement: Entitlement | null;
  /** When the free trial ends, where the store says; null outside a trial. */
  readonly trialEndsAt: Date | null;
  /** Whether anything is on sale, which decides if the profile shows the subscription. */
  readonly selling: boolean;
  readonly onBackUp: () => void;
  readonly backupProgress: BackupProgress | null;
  /** When a backup was last handed over; null before the first. */
  readonly lastBackup: Date | null;
  readonly onRestore: () => void;
  /** Mails a note to support; rejects when it could not be delivered. */
  readonly onFeedback: (text: string) => Promise<void>;
  /** Whether the phone looks to be in Ukraine, for the grounding's helpline. */
  readonly inUkraine: () => boolean;
  /** What opens this phone, which names the lock row in "Me". */
  readonly lockMethod: LockMethod;
  /** Asks for Face ID once before the lock is turned on. */
  readonly onEnableLock: () => Promise<boolean>;
}

/**
 * Which tab the bar shows lit. The stages the bar is absent from are not in
 * here at all, so a stage that forgets to answer cannot light the wrong one.
 */
const TAB_FOR_STAGE: Partial<Record<CaptureFlow['stage']['kind'], Tab>> = {
  idle: 'home',
  history: 'journal',
  settings: 'me',
};

export function CaptureFlowScreen(props: CaptureFlowScreenProps): React.JSX.Element {
  const tab = TAB_FOR_STAGE[props.flow.stage.kind];
  /*
   * The sheets are held here, above the tab bar, rather than inside the
   * screens that open them: they cover the bar while open, and drawing
   * them in the tree instead of a Modal is what lets a button take the
   * first tap while the keyboard is up.
   */
  const [writingFeedback, setWritingFeedback] = useState(false);
  /*
   * The kept affirmation opened from the journal's button: drawn over the
   * journal rather than in place of it, so its colour grows out of the button
   * and closing it leaves the journal exactly where it was.
   */
  const [affirmationFrom, setAffirmationFrom] = useState<BloomOrigin | null>(null);
  const kept = props.flow.keptAffirmation;
  const stageKind = props.flow.stage.kind;
  const { width } = useWindowDimensions();
  /*
   * The screens kept under the top one for a swipe back to land on as they
   * were (owner's word, 2026-11-24). Worked out as the stage changes, during
   * the render itself: a stack a render behind would draw the new stage's
   * screen with the old one's for a frame.
   */
  const stack = useRef<readonly CaptureStage[]>([]);

  if (stack.current[stack.current.length - 1] !== props.flow.stage) {
    stack.current = nextStack(stack.current, props.flow.stage);
  }

  const layers = stack.current.slice(-2);
  /* Each screen's own place, so the one coming back starts where it stands. */
  const shifts = useRef(new Map<string, Animated.Value>());
  const shiftOf = (key: string): Animated.Value => {
    const known = shifts.current.get(key);

    if (known !== undefined) {
      return known;
    }

    const made = new Animated.Value(0);

    shifts.current.set(key, made);

    return made;
  };
  const keptKeys = new Set(stack.current.map(screenKeyOf));

  for (const key of [...shifts.current.keys()]) {
    if (!keptKeys.has(key)) {
      shifts.current.delete(key);
    }
  }

  // Anything that takes the journal away takes the page over it too.
  useEffect(() => {
    setAffirmationFrom(null);
  }, [stageKind]);

  /*
   * The bar floats over the screen rather than beside it, so the content keeps
   * running underneath and nothing ends in a hard edge. Screens that live
   * under it leave the room in their own bottom padding.
   */
  return (
    <View style={{ flex: 1 }}>
      {layers.map((stage, at) => {
        const key = screenKeyOf(stage);
        const top = at === layers.length - 1;
        const above = layers[at + 1];

        return (
          <Layer
            key={key}
            under={above === undefined ? null : shiftOf(screenKeyOf(above))}
            width={width}
          >
            <SwipeBack onBack={top ? swipeBackFor(props.flow) : null} shift={shiftOf(key)}>
              <Stage
                {...props}
                // The screen underneath is drawn as it stands; the one on top is the flow itself.
                flow={top ? props.flow : { ...props.flow, stage }}
                onWriteFeedback={() => {
                  setWritingFeedback(true);
                }}
                onOpenAffirmation={setAffirmationFrom}
              />
            </SwipeBack>
          </Layer>
        );
      })}
      {tab === undefined ? null : (
        <TabBar
          active={tab}
          t={props.t}
          onSelect={(next) => {
            if (next === 'home') {
              props.flow.backHome();
            } else if (next === 'journal') {
              props.flow.openHistory();
            } else if (next === 'me') {
              props.flow.openSettings();
            }
          }}
        />
      )}
      {affirmationFrom === null || kept === null || kept === undefined ? null : (
        <AffirmationBloom
          charm={charmOf(kept.look)}
          text={kept.text}
          caption={affirmationCaption(kept.frequency, props.t)}
          origin={affirmationFrom}
          t={props.t}
          fadeOnClose
          onClose={() => {
            setAffirmationFrom(null);
          }}
        />
      )}
      <MilestoneSheet
        open={props.flow.milestoneSheet}
        locale={props.locale}
        today={props.today}
        t={props.t}
        onSave={props.flow.saveMilestone}
        onDelete={props.flow.deleteMilestone}
        onClose={props.flow.closeMilestone}
      />
      <FeedbackSheet
        open={writingFeedback}
        t={props.t}
        onSend={props.onFeedback}
        onClose={() => {
          setWritingFeedback(false);
        }}
      />
      <Toast
        line={lineFor(props.flow.notice, props.t)}
        dismissHint={props.t('notice.dismiss')}
        onDismiss={props.flow.dismissNotice}
      />
      <UndoToast
        showing={props.flow.undoable}
        t={props.t}
        onUndo={props.flow.undoDelete}
        onSettle={props.flow.settleDelete}
      />
    </View>
  );
}

/**
 * The journal's affirmation button: nothing while affirmations are off or
 * before the store has answered, the picked one's look, or the waiting mark.
 */
function affirmationButton(
  on: boolean,
  kept: KeptAffirmation | null | undefined,
): { readonly picked: Charm | null } | null {
  if (!on || kept === undefined) {
    return null;
  }

  return { picked: kept === null ? null : charmOf(kept.look) };
}

/** How far left the screen underneath sits while the one above covers it, as a share of the width. */
const UNDER_OFFSET = 0.3;
/** How much of the scrim lies over the screen underneath while covered; it clears as the one above leaves. */
const UNDER_DIM = 0.25;

/**
 * One screen in the stack; its ground moves with it, inside `SwipeBack`.
 * Covered, it sits a little to the left, dimmed and out of reach of touch,
 * and moves into place as the screen above it is swiped away, as the
 * system's own back does.
 */
function Layer(props: {
  /** How far the screen above has moved; null for the screen on top. */
  readonly under: Animated.Value | null;
  readonly width: number;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const { under, width } = props;
  const moving = under !== null && !theme.reduceMotion;

  return (
    <Animated.View
      pointerEvents={under === null ? 'auto' : 'none'}
      importantForAccessibility={under === null ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={under !== null}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        transform: [
          {
            translateX: moving
              ? under.interpolate({ inputRange: [0, width], outputRange: [-width * UNDER_OFFSET, 0], extrapolate: 'clamp' })
              : 0,
          },
        ],
      }}
    >
      {props.children}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.palette.scrim,
          opacity: moving
            ? under.interpolate({ inputRange: [0, width], outputRange: [UNDER_DIM, 0], extrapolate: 'clamp' })
            : 0,
        }}
      />
    </Animated.View>
  );
}

/**
 * Where a swipe from the left edge goes (owner's word, 2026-11-16): the same
 * place as the screen's own back button, and nowhere on a screen without one.
 */
function swipeBackFor(flow: CaptureFlow): (() => void) | null {
  switch (flow.stage.kind) {
    case 'writing':
    case 'stats':
    case 'subscription':
      return flow.backHome;
    // The card's later steps go back a step; its first has nowhere to go but the bin.
    case 'turn':
      return flow.stage.step === 'words' ? null : flow.stepBack;
    case 'month':
      return flow.closeMonth;
    case 'months':
    case 'vocabulary':
      return flow.openStats;
    case 'legal':
      return flow.openSubscription;
    case 'detail':
      return flow.closeEntry;
    default:
      return null;
  }
}

/**
 * The notice in the app's words. A failure keeps the layer below's own
 * message under the title — it is the one line the owner gets to read when
 * someone writes in — while the network's failure gets the two lines that say
 * where the entry is going, and a take without words the two that say to
 * record again.
 */
function lineFor(notice: Notice | null, t: Translate): ToastLine | null {
  if (notice === null) {
    return null;
  }

  switch (notice.kind) {
    case 'unheard':
      return { id: notice.id, title: t('notice.offlineTitle'), detail: t('notice.offlineBody') };
    case 'silent':
      return { id: notice.id, title: t('notice.silentTitle'), detail: t('notice.silentBody') };
    case 'failed':
      return { id: notice.id, title: t('failure.title'), detail: notice.message };
  }
}

/** Opens the App Store page of the newer version; nothing while this one is the newest. */
function updateOpener(update: StoreRelease | null): (() => void) | null {
  return update === null
    ? null
    : () => {
        void Linking.openURL(update.url);
      };
}

/** A month as "YYYY-MM", the way a closed month card is remembered. */
function monthKey(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The words the question card offers: what Vidlun heard and the words its
 * reading put beside it, the broad words when Vidlun could not listen, and
 * none yet while it is still reading — the processing screen stands in for
 * the card until then. The draft itself never reaches the card.
 */
function wordsFor(
  stage: Extract<CaptureFlow['stage'], { kind: 'turn' }>,
  vocabulary: EmotionVocabulary,
): readonly Emotion[] | null {
  if (stage.unheard) {
    return wordsWithoutReading(vocabulary.all());
  }

  if (stage.draft === null) {
    return null;
  }

  const heard = stage.draft.proposedEmotionIds
    .map((id) => vocabulary.find(id))
    .filter((emotion): emotion is Emotion => emotion !== undefined);

  return wordsOffered(heard, stage.nearby, stage.draft.mood?.value ?? null, vocabulary.all());
}

function Stage(
  props: CaptureFlowScreenProps & {
    readonly onWriteFeedback: () => void;
    readonly onOpenAffirmation: (origin: BloomOrigin) => void;
  },
): React.JSX.Element {
  const { flow, t } = props;
  const entitlement = props.entitlement ?? 'none';
  // Whether every entry reads; null while the store has not answered (owner's word, 2026-11-17).
  const readsAll = props.entitlement === null ? null : readsInFull(props.entitlement);
  // Monthly without a subscription: one affirmation a month is free (owner's word, 2026-11-17).
  const affirmationFrequency = affirmationFrequencyFor(
    props.settings.affirmationFrequency,
    readsAll === true,
  );

  switch (flow.stage.kind) {
    case 'recording': {
      // A minute free, five paid. The cap is a product decision, not audio's.
      const paid = entitlement !== 'none';

      return (
        <RecordingScreen
          t={t}
          limitSeconds={paid ? 300 : 60}
          showsLimit={!paid}
          onStop={flow.stopRecording}
          onPause={flow.pauseRecording}
          onResume={flow.resumeRecording}
          onCancel={flow.cancel}
          level={flow.voiceLevel}
          interrupted={flow.recordingInterrupted}
        />
      );
    }

    case 'writing':
      return <TextEntryScreen t={t} onSubmit={flow.submitText} onBack={flow.backHome} />;

    case 'processing':
    case 'saving':
      return <ProcessingScreen t={t} />;

    case 'parked':
      return (
        <ParkedScreen t={t} onHome={flow.backHome} />
      );

    case 'turn': {
      const card = flow.stage;
      const offered = wordsFor(card, props.vocabulary);
      const draft = card.draft;

      // The card goes up whole, once there are words to offer (owner's word, 2026-10-01).
      if (offered === null || draft === null) {
        return <ProcessingScreen t={t} />;
      }

      // Three steps (owner's word, 2026-11-23): the words, the feelings, the mood.
      if (card.step === 'words') {
        return (
          <CardWordsScreen
            transcript={card.spoken.text}
            createdAt={draft.createdAt}
            take={flow.take}
            topics={{ proposed: draft.contextTags, dropped: card.droppedTopics, added: card.addedTopics }}
            locale={props.locale}
            t={t}
            onCorrect={flow.correctWording}
            onToggleTopic={flow.toggleTopic}
            onAddTopic={flow.addTopic}
            onOpenTopic={flow.readKnownTopics}
            onNext={flow.toFeelings}
            onDiscard={flow.discardEntry}
          />
        );
      }

      if (card.step === 'feelings') {
        return (
          <CardFeelingsScreen
            transcript={card.spoken.text}
            createdAt={draft.createdAt}
            chosen={card.chosen}
            vocabulary={props.vocabulary}
            offered={offered}
            heard={card.unheard ? [] : draft.proposedEmotionIds}
            sawTogether={card.namedAlone !== null}
            tookTogether={card.together}
            locale={props.locale}
            t={t}
            onToggle={flow.toggleOwnWord}
            onAddWord={flow.addOwnWord}
            onNext={flow.toMood}
            onOpenTogether={flow.openTogether}
            onChooseTogether={flow.chooseTogether}
            onBack={flow.stepBack}
            onDiscard={flow.discardEntry}
          />
        );
      }

      return (
        <CardMoodScreen
          createdAt={draft.createdAt}
          mood={card.mood ?? draft.mood?.value ?? null}
          locale={props.locale}
          t={t}
          onMood={flow.setMood}
          onSave={flow.answer}
          onBack={flow.stepBack}
          onDiscard={flow.discardEntry}
        />
      );
    }

    case 'reflecting':
      return (
        <ReflectionScreen
          draft={flow.stage.draft}
          vocabulary={props.vocabulary}
          t={t}
          onConfirm={flow.confirm}
        />
      );

    case 'saved':
      return (
        <SavedScreen
          t={t}
          // After a hard entry the grounding offer follows on a page of its own.
          onDone={flow.stage.offersGrounding ? flow.startGrounding : flow.leaveSaved}
        />
      );

    case 'affirmation':
      return (
        <AffirmationScreen
          t={t}
          locale={props.locale}
          frequency={affirmationFrequency}
          kept={flow.stage.kept}
          onKeep={(choice) => {
            flow.keepAffirmation(choice, affirmationFrequency);
          }}
          onFlip={flow.noticed}
          onClose={flow.closeAffirmation}
        />
      );

    case 'grounding':
      return (
        <GroundingScreen
          t={t}
          offered={flow.stage.from === 'saved'}
          helpline={props.inUkraine()}
          onClose={flow.leaveGrounding}
          onHome={flow.backHome}
          onNotice={flow.noticed}
        />
      );

    case 'settings':
      return (
        <ProfileScreen
          settings={props.settings}
          onBackUp={props.onBackUp}
          backupProgress={props.backupProgress}
          lastBackup={props.lastBackup}
          today={props.today}
          onRestore={props.onRestore}
          onWriteFeedback={props.onWriteFeedback}
          t={t}
          onChange={props.onSettingsChange}
          entitlement={entitlement}
          selling={props.selling}
          onOpenSubscription={flow.openSubscription}
          onRedeemCode={flow.redeemCode}
          onGround={flow.openGrounding}
          lockMethod={props.lockMethod}
          onEnableLock={props.onEnableLock}
        />
      );

    case 'stats':
      return (
        <StatsScreen
          view={flow.stage.view}
          locale={props.locale}
          t={t}
          onBack={flow.backHome}
          onEarlierWeek={flow.showEarlierWeek}
          onLaterWeek={flow.showLaterWeek}
          onOpenVocabulary={flow.openVocabulary}
          onOpenMonths={flow.openMonths}
          onOpenDay={flow.openHistory}
          onOpenSubscription={flow.openSubscription}
          onOpenEntries={flow.openJournalFocus}
          milestones={flow.milestones}
        />
      );

    case 'month':
      return (
        <MonthScreen
          month={flow.stage.month}
          locale={props.locale}
          today={props.today}
          t={t}
          voice={flow.stage.voice}
          composeVoice={flow.composeMonthVoice}
          onOpenEntry={flow.openEntry}
          onBack={flow.closeMonth}
        />
      );

    case 'months':
      return (
        <MonthsScreen
          months={flow.stage.months}
          locale={props.locale}
          t={t}
          onBack={flow.openStats}
          onOpen={flow.openMonthOf}
        />
      );

    case 'vocabulary':
      return flow.stage.growth === null ? (
        <ProcessingScreen t={t} />
      ) : (
        <VocabularyScreen
          growth={flow.stage.growth}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          earliest={flow.stage.earliest ?? flow.stage.growth.from}
          entryDays={flow.stage.entryDays}
          t={t}
          onSeeWeek={flow.openStats}
          onPeriodChange={flow.showPeriod}
        />
      );

    case 'subscription':
      return (
        <SubscriptionScreen
          entitlement={entitlement}
          trialEndsAt={props.trialEndsAt}
          plans={flow.stage.plans}
          outcome={flow.stage.outcome}
          locale={props.locale}
          t={t}
          onSubscribe={flow.subscribe}
          onRestore={flow.restorePurchase}
          onRedeemCode={flow.redeemCode}
          onDismissOutcome={flow.dismissPurchaseOutcome}
          onRetryPlans={flow.openSubscription}
          onOpenTerms={() => flow.openLegal('terms')}
          onOpenPrivacy={() => flow.openLegal('privacy')}
          onBack={flow.backHome}
        />
      );

    case 'legal':
      return (
        <LegalScreen
          document={legalDocument(flow.stage.doc, props.locale)}
          t={t}
          onBack={flow.openSubscription}
        />
      );

    case 'history':
      return (
        <HistoryScreen
          // Held back until the store answers, so no entry shows and then locks.
          days={readsAll === null ? null : flow.history}
          recorded={flow.recorded}
          filter={flow.journalFilter}
          onFilter={flow.filterJournal}
          onOpenTopic={flow.openTopic}
          query={flow.journalQuery}
          onQuery={flow.searchJournal}
          focus={flow.journalFocus}
          onClearFocus={flow.clearJournalFocus}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          t={t}
          onOpen={flow.openEntry}
          readsAll={readsAll === true}
          onOpenSubscription={flow.openSubscription}
          onDelete={flow.deleteEntry}
          onRecord={flow.startRecording}
          milestones={flow.milestones}
          onEditMilestone={flow.openMilestone}
        />
      );

    case 'detail':
      return (
        <EntryDetailScreen
          // Each entry opens as the drawing has it: voice folded, transcript open (owner's word, 2026-11-24).
          key={flow.stage.entry.id}
          entry={flow.stage.entry}
          recordingUri={flow.stage.recordingUri}
          recordingKnown={flow.stage.recordingKnown}
          speech={flow.stage.speech}
          voice={flow.stage.voice}
          found={flow.stage.found}
          playFromMs={flow.stage.playFromMs}
          keepRecordings={props.settings.keepRecordings}
          vocabulary={props.vocabulary}
          locale={props.locale}
          t={t}
          onOpenTopic={flow.openTopic}
          onDelete={flow.deleteEntry}
          onBack={flow.closeEntry}
        />
      );

    case 'idle':
      return (
        <HomeScreen
          home={flow.home}
          monthCard={
            flow.monthCard !== null && monthKey(flow.monthCard) !== props.settings.monthCardClosed
              ? flow.monthCard
              : null
          }
          onCloseMonth={() => {
            if (flow.monthCard !== null) {
              props.onSettingsChange({ ...props.settings, monthCardClosed: monthKey(flow.monthCard) });
            }
          }}
          onSayYesterday={flow.startYesterday}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          t={t}
          onRecord={flow.startRecording}
          onWrite={flow.startWriting}
          parked={flow.parked}
          onContinueParked={flow.continueParked}
          mic={flow.micStatus}
          milestones={flow.milestones}
          onOpenStats={flow.openStats}
          onOpenMonth={flow.openMonth}
          onOpen={flow.openEntry}
          onDelete={flow.deleteEntry}
          readsAll={readsAll}
          onOpenSubscription={flow.openSubscription}
          onUpdate={updateOpener(
            flow.update !== null && flow.update.version !== props.settings.updateLineClosed
              ? flow.update
              : null,
          )}
          affirmation={affirmationButton(props.settings.affirmationsOn, flow.keptAffirmation)}
          onAffirmation={(origin) => {
            // A waiting one opens the five; the picked one grows out of the button over home.
            if (flow.keptAffirmation === null || flow.keptAffirmation === undefined) {
              flow.pickAffirmation();
            } else {
              props.onOpenAffirmation(origin);
            }
          }}
          onCloseUpdate={() => {
            if (flow.update !== null) {
              props.onSettingsChange({ ...props.settings, updateLineClosed: flow.update.version });
            }
          }}
        />
      );
  }
}
