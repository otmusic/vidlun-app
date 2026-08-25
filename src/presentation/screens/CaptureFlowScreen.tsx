import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import type { CaptureFlow } from '../hooks/useCaptureFlow';
import { EditScreen } from './EditScreen';
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

    case 'idle':
      return (
        <HomeScreen
          home={flow.home}
          locale={props.locale}
          t={t}
          onRecord={flow.startRecording}
          onWrite={flow.startWriting}
          onDelete={flow.deleteEntry}
        />
      );
  }
}
