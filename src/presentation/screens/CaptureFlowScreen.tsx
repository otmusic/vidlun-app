import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { Entitlement } from '@/domain/entities/Entitlement';
import type { Settings } from '@/domain/ports/ISettings';
import type { Locale, Translate } from '@/i18n';

import { View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { TabBar, type Tab } from '../components/TabBar';
import type { CaptureFlow } from '../hooks/useCaptureFlow';
import { EditScreen } from './EditScreen';
import { EntryDetailScreen } from './EntryDetailScreen';
import { HistoryScreen } from './HistoryScreen';
import { HomeScreen } from './HomeScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { CompareScreen } from './CompareScreen';
import { RecordingScreen } from './RecordingScreen';
import { TurnScreen } from './TurnScreen';
import { ReflectionScreen } from './ReflectionScreen';
import { SavedScreen } from './SavedScreen';
import { ProfileScreen } from './ProfileScreen';
import { SearchScreen } from './SearchScreen';
import { SubscriptionScreen } from './SubscriptionScreen';
import { StatsScreen } from './StatsScreen';
import { VocabularyScreen } from './VocabularyScreen';
import { Screen } from './Screen';
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

  if (tab === undefined) {
    return <Stage {...props} />;
  }

  /*
   * The bar floats over the screen rather than beside it, so the content keeps
   * running underneath and nothing ends in a hard edge. Screens that live
   * under it leave the room in their own bottom padding.
   */
  return (
    <View style={{ flex: 1 }}>
      <Stage {...props} />
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
    </View>
  );
}

function Stage(props: CaptureFlowScreenProps): React.JSX.Element {
  const { flow, t } = props;

  switch (flow.stage.kind) {
    case 'recording':
      return <RecordingScreen t={t} onStop={flow.stopRecording} onCancel={flow.cancel} />;

    case 'writing':
      return <TextEntryScreen t={t} onSubmit={flow.submitText} onCancel={flow.backHome} />;

    case 'processing':
      return <ProcessingScreen t={t} />;

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
      return <SavedScreen t={t} streakDays={flow.stage.streakDays} onHome={flow.backHome} />;

    case 'failed':
      return (
        <Screen centered>
          <AppText variant="display" align="center">
            {t('failure.title')}
          </AppText>
          <AppText variant="secondary" color="inkSoft" align="center">
            {flow.stage.message}
          </AppText>
          <Button label={t('failure.retry')} onPress={flow.backHome} />
        </Screen>
      );

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
          outcome={flow.stage.outcome}
          t={t}
          onSubscribe={flow.subscribe}
          onRestore={flow.restorePurchase}
          onDismissOutcome={flow.dismissPurchaseOutcome}
          onBack={flow.backHome}
        />
      );

    case 'search':
      return (
        <SearchScreen
          result={flow.stage.result}
          query={flow.stage.query}
          emotionId={flow.stage.emotionId}
          vocabulary={props.vocabulary}
          locale={props.locale}
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
          t={t}
          onOpen={flow.openEntry}
          onRecord={flow.startRecording}
        />
      );

    case 'detail':
      return (
        <EntryDetailScreen
          entry={flow.stage.entry}
          recordingUri={flow.stage.recordingUri}
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
          locale={props.locale}
          t={t}
          onRecord={flow.startRecording}
          onWrite={flow.startWriting}
          onDelete={flow.deleteEntry}
          onOpenHistory={flow.openHistory}
          onOpenStats={flow.openStats}
          onOpen={flow.openEntry}
        />
      );
  }
}
