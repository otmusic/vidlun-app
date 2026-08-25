import { ScrollView, View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EntryChips } from '../components/EntryChips';
import { useTheme } from '../theme/ThemeProvider';

export interface ReflectionScreenProps {
  readonly draft: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
  readonly onConfirm: () => void;
  readonly onEdit: () => void;
}

export function ReflectionScreen(props: ReflectionScreenProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.canvas }}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingTop: 64,
          gap: theme.spacing.md,
          flexGrow: 1,
        }}
      >
        <AppText variant="caption" color="inkFaint">
          {props.t('reflection.eyebrow')}
        </AppText>

        <Card tone="quiet">
          <AppText variant="quote">{`«${props.draft.cleanTranscript}»`}</AppText>
        </Card>

        <AppText variant="secondary" color="inkSoft">
          {props.t('reflection.heard')}
        </AppText>

        <EntryChips entry={props.draft} vocabulary={props.vocabulary} t={props.t} />

        {/* A crisis entry carries no observation at all — the domain nulls it,
            and what the app shows instead is still an open product decision. */}
        {props.draft.observation !== null ? (
          <Card tone="accent">
            <AppText variant="narrative">{props.draft.observation}</AppText>
          </Card>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={props.t('reflection.confirm')} onPress={props.onConfirm} />
          <Button label={props.t('reflection.edit')} variant="secondary" onPress={props.onEdit} />
        </View>
      </ScrollView>
    </View>
  );
}
