import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { Entitlement } from '@/domain/entities/Entitlement';
import type { Settings } from '@/domain/ports/ISettings';
import type { Locale, Translate } from '@/i18n';
import { legalDocument } from '@/i18n/legal';

import { useState } from 'react';
import { View } from 'react-native';

import { FeedbackSheet } from '../components/FeedbackSheet';
import { MilestoneSheet } from '../components/MilestoneSheet';
import { TabBar, type Tab } from '../components/TabBar';
import { Toast, type ToastLine } from '../components/Toast';
import type { CaptureFlow, Notice } from '../hooks/useCaptureFlow';
import { EditScreen } from './EditScreen';
import { EntryDetailScreen } from './EntryDetailScreen';
import { HistoryScreen } from './HistoryScreen';
import { HomeScreen } from './HomeScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ParkedScreen } from './ParkedScreen';
import { CompareScreen } from './CompareScreen';
import { RecordingScreen } from './RecordingScreen';
import { TurnScreen } from './TurnScreen';
import { ReflectionScreen } from './ReflectionScreen';
import { GroundingScreen } from './GroundingScreen';
import { SavedScreen } from './SavedScreen';
import { ProfileScreen } from './ProfileScreen';
import { SearchScreen } from './SearchScreen';
import { LegalScreen } from './LegalScreen';
import { SubscriptionScreen } from './SubscriptionScreen';
import { StatsScreen } from './StatsScreen';
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
  readonly entitlement: Entitlement;
  readonly onExport: (shape: 'backup' | 'markdown') => void;
  readonly onRestore: () => void;
  readonly onEnableLock: () => Promise<boolean>;
  /** Mails a note to support; rejects when it could not be delivered. */
  readonly onFeedback: (text: string) => Promise<void>;
}

/**
 * Which tab the bar shows lit. The stages the bar is absent from are not in
 * here at all, so a stage that forgets to answer cannot light the wrong one.
 */
const TAB_FOR_STAGE: Partial<Record<CaptureFlow['stage']['kind'], Tab>> = {
  idle: 'home',
  history: 'journal',
  search: 'search',
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
   * The bar floats over the screen rather than beside it, so the content keeps
   * running underneath and nothing ends in a hard edge. Screens that live
   * under it leave the room in their own bottom padding.
   */
  return (
    <View style={{ flex: 1 }}>
      <Stage
        {...props}
        onWriteFeedback={() => {
          setWritingFeedback(true);
        }}
      />
      {tab === undefined ? null : (
        <TabBar
          active={tab}
          t={props.t}
          onSelect={(next) => {
            if (next === 'home') {
              props.flow.backHome();
            } else if (next === 'journal') {
              props.flow.openHistory();
            } else if (next === 'search') {
              props.flow.openSearch();
            } else if (next === 'me') {
              props.flow.openSettings();
            }
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
    </View>
  );
}

/**
 * The notice in the app's words. A failure keeps the layer below's own
 * message under the title — it is the one line the owner gets to read when
 * someone writes in — and the network's failure gets the two lines that say
 * where the entry is going instead.
 */
function lineFor(notice: Notice | null, t: Translate): ToastLine | null {
  if (notice === null) {
    return null;
  }

  return notice.kind === 'unheard'
    ? { id: notice.id, title: t('notice.offlineTitle'), detail: t('notice.offlineBody') }
    : { id: notice.id, title: t('failure.title'), detail: notice.message };
}

function Stage(
  props: CaptureFlowScreenProps & { readonly onWriteFeedback: () => void },
): React.JSX.Element {
  const { flow, t } = props;

  switch (flow.stage.kind) {
    case 'recording': {
      // A minute free, five paid. The cap is a product decision, not audio's.
      const paid = props.entitlement !== 'none';

      return (
        <RecordingScreen
          t={t}
          limitSeconds={paid ? 300 : 60}
          showsLimit={!paid}
          onStop={flow.stopRecording}
          onCancel={flow.cancel}
        />
      );
    }

    case 'writing':
      return <TextEntryScreen t={t} onSubmit={flow.submitText} onCancel={flow.backHome} />;

    case 'processing':
      return <ProcessingScreen t={t} />;

    case 'parked':
      return (
        <ParkedScreen t={t} onHome={flow.backHome} />
      );

    case 'turn':
      return (
        <TurnScreen
          transcript={flow.stage.spoken.text}
          chosen={flow.stage.chosen}
          vocabulary={props.vocabulary}
          holding={flow.stage.holding}
          t={t}
          onToggle={flow.toggleOwnWord}
          onRefine={flow.refineOwnWord}
          onCorrect={flow.correctWording}
          onNext={flow.answer}
          onSkip={flow.skipAnswer}
        />
      );

    case 'comparing':
      return (
        <CompareScreen
          proposed={flow.stage.proposed}
          draft={flow.stage.draft}
          vocabulary={props.vocabulary}
          t={t}
          onAdopt={flow.adopt}
          onUnkeep={flow.unkeep}
          onKeepMine={flow.keepMine}
          keptMine={flow.keptMine}
          onConfirm={flow.confirm}
          onEdit={flow.beginEditing}
          onBack={flow.backHome}
        />
      );

    case 'reflecting':
      return (
        <ReflectionScreen
          draft={flow.stage.draft}
          vocabulary={props.vocabulary}
          t={t}
          onConfirm={flow.confirm}
          onEdit={flow.beginEditing}
        />
      );

    case 'editing':
      return (
        <EditScreen
          draft={flow.stage.draft}
          vocabulary={props.vocabulary}
          t={t}
          onDone={flow.applyEdits}
        />
      );

    case 'saved':
      return (
        <SavedScreen
          t={t}
          offersGrounding={flow.stage.offersGrounding}
          onGround={flow.startGrounding}
          onHome={flow.backHome}
        />
      );

    case 'grounding':
      return <GroundingScreen t={t} onLeave={flow.backHome} />;

    case 'settings':
      return (
        <ProfileScreen
          entryCount={
            flow.history === null
              ? null
              : flow.history.reduce((total, day) => total + day.entries.length, 0)
          }
          streakDays={flow.home?.streakDays ?? 0}
          settings={props.settings}
          onExport={props.onExport}
          onRestore={props.onRestore}
          onEnableLock={props.onEnableLock}
          onWriteFeedback={props.onWriteFeedback}
          t={t}
          onChange={props.onSettingsChange}
          entitlement={props.entitlement}
          onOpenSubscription={flow.openSubscription}
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
          onOpenDay={flow.openHistory}
          onOpenSubscription={flow.openSubscription}
          milestones={flow.milestones}
          onMarkMilestone={() => {
            flow.openMilestone();
          }}
          onEditMilestone={flow.openMilestone}
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
          t={t}
          onSeeWeek={flow.openStats}
          onPeriodChange={flow.showPeriod}
        />
      );

    case 'subscription':
      return (
        <SubscriptionScreen
          entitlement={props.entitlement}
          plans={flow.stage.plans}
          outcome={flow.stage.outcome}
          locale={props.locale}
          t={t}
          onSubscribe={flow.subscribe}
          onRestore={flow.restorePurchase}
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

    case 'search':
      return (
        <SearchScreen
          result={flow.stage.result}
          journalEmpty={flow.home !== null && flow.home.recentEntries.length === 0}
          query={flow.stage.query}
          emotionId={flow.stage.emotionId}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          t={t}
          onQuery={(query) => {
            flow.search(query, flow.stage.kind === 'search' ? flow.stage.emotionId : null);
          }}
          onFilter={(emotionId) => {
            flow.search(flow.stage.kind === 'search' ? flow.stage.query : '', emotionId);
          }}
          onReset={() => {
            flow.search('', null);
          }}
          onOpen={flow.openEntry}
        />
      );

    case 'history':
      return (
        <HistoryScreen
          days={flow.history}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          t={t}
          onOpen={flow.openEntry}
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
          keepRecordings={props.settings.keepRecordings}
          onFix={flow.fixEntryWording}
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
          monthCard={flow.monthCard}
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
          onOpen={flow.openEntry}
          onDelete={flow.deleteEntry}
        />
      );
  }
}
