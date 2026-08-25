import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { Settings } from '@/domain/ports/ISettings';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import type { CaptureFlow } from '../hooks/useCaptureFlow';
import { EditScreen } from './EditScreen';
import { EntryDetailScreen } from './EntryDetailScreen';
import { HistoryScreen } from './HistoryScreen';
import { SettingsScreen } from './SettingsScreen';
import { HomeScreen } from './HomeScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { RecordingScreen } from './RecordingScreen';
import { ReflectionScreen } from './ReflectionScreen';
import { SavedScreen } from './SavedScreen';
import { Screen } from './Screen';
import { TextEntryScreen } from './TextEntryScreen';

export interface CaptureFlowScreenProps {
  readonly flow: CaptureFlow;
  readonly vocabulary: EmotionVocabulary;
  readonly settings: Settings;
  readonly onSettingsChange: (settings: Settings) => void;
  readonly locale: Locale;
  readonly t: Translate;
}

export function CaptureFlowScreen(props: CaptureFlowScreenProps): React.JSX.Element {
  const { flow, t } = props;

  switch (flow.stage.kind) {
    case 'recording':
      return <RecordingScreen t={t} onStop={flow.stopRecording} onCancel={flow.cancel} />;

    case 'writing':
      return <TextEntryScreen t={t} onSubmit={flow.submitText} onCancel={flow.backHome} />;

    case 'processing':
      return <ProcessingScreen t={t} />;

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
        <SettingsScreen
          settings={props.settings}
          t={t}
          onChange={props.onSettingsChange}
          onBack={flow.backHome}
        />
      );

    case 'history':
      return (
        <HistoryScreen
          days={flow.history}
          locale={props.locale}
          t={t}
          onOpen={flow.openEntry}
          onDelete={flow.deleteEntry}
          onBack={flow.backHome}
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
          onBack={flow.openHistory}
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
          onOpenSettings={flow.openSettings}
          onOpen={flow.openEntry}
        />
      );
  }
}
