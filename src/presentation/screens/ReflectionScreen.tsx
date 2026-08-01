import { ScrollView, View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { emotionKey, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { toneOf } from '../components/emotionTone';
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

        {props.draft.hasEmotions ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {props.draft.emotionIds.map((id) => {
              const emotion = props.vocabulary.find(id);

              return (
                <Chip
                  key={id}
                  label={props.t(emotionKey(id))}
                  tone={emotion === undefined ? 'neutral' : toneOf(emotion)}
                />
              );
            })}
            {props.draft.contextTags.map((tag) => (
              <Chip key={tag} label={tag} tone="neutral" />
            ))}
          </View>
        ) : (
          <AppText variant="secondary" color="inkFaint">
            {props.t('reflection.noEmotions')}
          </AppText>
        )}

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
