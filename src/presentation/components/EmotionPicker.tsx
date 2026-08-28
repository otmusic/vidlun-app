import { View } from 'react-native';

import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Translate, type TranslationKey } from '@/i18n';

import { AppText } from './AppText';
import { Chip } from './Chip';
import { EMOTION_GROUPS, groupOf, type EmotionGroup } from './emotionTone';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

const GROUP_LABELS: Record<EmotionGroup, TranslationKey> = {
  pleasantCalm: 'edit.groupPleasantCalm',
  pleasantEnergetic: 'edit.groupPleasantEnergetic',
  tense: 'edit.groupTense',
  heavy: 'edit.groupHeavy',
};

/**
 * The four shelves people actually reach for, read off valence and energy
 * rather than off the Feeling Wheel's branches.
 *
 * Only the top two levels are offered. The third is reachable but long, and a
 * picker that lists everything is a form — which is the one thing this product
 * is not.
 */
export function EmotionPicker(props: {
  readonly vocabulary: EmotionVocabulary;
  readonly selected: readonly string[];
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      {EMOTION_GROUPS.map((group) => (
        <Group key={group} group={group} {...props} />
      ))}
    </View>
  );
}

function Group(props: {
  readonly group: EmotionGroup;
  readonly vocabulary: EmotionVocabulary;
  readonly selected: readonly string[];
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const scheme = theme.isDark ? 'dark' : 'light';
  const offered = props.vocabulary
    .all()
    .filter((emotion: Emotion) => emotion.depth <= 2 && groupOf(emotion) === props.group);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" color="inkFaint">
        {props.t(GROUP_LABELS[props.group])}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {offered.map((emotion) => (
          <Chip
            key={emotion.id}
            label={props.t(emotionKey(emotion.id))}
            color={colorForEmotion(props.vocabulary, emotion, scheme)}
            selected={props.selected.includes(emotion.id)}
            action="add"
            onPress={() => {
              props.onToggle(emotion.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}
