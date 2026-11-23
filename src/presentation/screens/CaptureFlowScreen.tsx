import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { affirmationFrequencyFor, readsInFull, type Entitlement } from '@/domain/entities/Entitlement';
import type { LockMethod } from '@/domain/ports/IScreenLock';
import type { Settings } from '@/domain/ports/ISettings';
import type { StoreRelease } from '@/domain/ports/IStoreListing';
import type { Locale, Translate } from '@/i18n';
import { legalDocument } from '@/i18n/legal';

import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { wordsOffered, wordsWithoutReading } from '../components/emotionTone';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { MilestoneSheet } from '../components/MilestoneSheet';
import { TabBar, type Tab } from '../components/TabBar';
import { Toast, type ToastLine } from '../components/Toast';
import { UndoToast } from '../components/UndoToast';
import type { CaptureFlow, Notice } from '../hooks/useCaptureFlow';
import { SwipeBack } from '../components/SwipeBack';
import { EntryDetailScreen } from './EntryDetailScreen';
import { HistoryScreen } from './HistoryScreen';
import { HomeScreen } from './HomeScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ParkedScreen } from './ParkedScreen';
import { CompareScreen } from './CompareScreen';
import { RecordingScreen } from './RecordingScreen';
import { TurnScreen } from './TurnScreen';
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
      <SwipeBack onBack={swipeBackFor(props.flow)}>
        <Stage
          {...props}
          onWriteFeedback={() => {
            setWritingFeedback(true);
          }}
          onOpenAffirmation={setAffirmationFrom}
        />
      </SwipeBack>
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
    case 'comparing':
      return flow.backToCard;
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
      const offered = wordsFor(flow.stage, props.vocabulary);

      // The card goes up whole, once there are words to offer (owner's word, 2026-10-01).
      if (offered === null) {
        return <ProcessingScreen t={t} />;
      }

      return (
        <TurnScreen
          transcript={flow.stage.spoken.text}
          chosen={flow.stage.chosen}
          vocabulary={props.vocabulary}
          offered={offered}
          t={t}
          onToggle={flow.toggleOwnWord}
          onAddWord={flow.addOwnWord}
          onCorrect={flow.correctWording}
          onNext={flow.answer}
          onTogether={flow.chooseTogether}
          choseTogether={flow.stage.namedAlone !== null}
          mood={flow.stage.mood ?? flow.stage.draft?.mood?.value ?? null}
          onMood={flow.setMood}
          topics={flow.stage.draft?.contextTags ?? []}
          droppedTopics={flow.stage.droppedTopics}
          onToggleTopic={flow.toggleTopic}
          onDiscard={flow.discardEntry}
        />
      );
    }

    case 'comparing':
      return (
        <CompareScreen
          proposed={flow.stage.proposed}
          draft={flow.stage.draft}
          vocabulary={props.vocabulary}
          t={t}
          onToggle={flow.toggleKept}
          onAddWord={flow.addKept}
          onKeep={flow.keepChosenTogether}
          onBack={flow.backToCard}
        />
      );

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
          entry={flow.stage.entry}
          recordingUri={flow.stage.recordingUri}
          voice={flow.stage.voice}
          found={flow.stage.found}
          playFromMs={flow.stage.playFromMs}
          keepRecordings={props.settings.keepRecordings}
          vocabulary={props.vocabulary}
          locale={props.locale}
          t={t}
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
