import { View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { emotionKey, type Translate } from '@/i18n';

import { AppText } from './AppText';
import { Chip } from './Chip';
import { toneOf } from './emotionTone';
import { useTheme } from '../theme/ThemeProvider';

/**
 * What Vidlun heard, as chips. Shared by the card and the entry it becomes, so
 * an entry looks the same when you come back to it a month later as it did the
 * moment you saved it.
 */
export function EntryChips(props: {
  readonly entry: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();

  if (!props.entry.hasEmotions && props.entry.contextTags.length === 0) {
    return (
      <AppText variant="secondary" color="inkFaint">
        {props.t('reflection.noEmotions')}
      </AppText>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {props.entry.emotionIds.map((id) => {
        const emotion = props.vocabulary.find(id);

        return (
          <Chip
            key={id}
            label={props.t(emotionKey(id))}
            tone={emotion === undefined ? 'neutral' : toneOf(emotion)}
          />
        );
      })}
      {props.entry.contextTags.map((tag) => (
        <Chip key={tag} label={tag} tone="neutral" />
      ))}
    </View>
  );
}
