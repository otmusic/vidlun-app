import { View } from 'react-native';

import type { Emotion } from '@/domain/entities/Emotion';
import { emotionKey, type Translate } from '@/i18n';

import { Chip } from './Chip';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A handful of emotion words as chips, in the order they are given — no
 * shelves and no shelf names (owner's word, 2026-09-30): the question card
 * offers the words nearest to what was said, and the person types their own
 * when none fits.
 *
 * Flat, with nothing under a word (owner's word, 2026-10-07): a tap chooses
 * the word and a second tap lets it go. The "more precisely?" row that a
 * chosen word used to open read as a feature nobody had asked for.
 */
export function EmotionShelf(props: {
  readonly emotions: readonly Emotion[];
  readonly selected: readonly string[];
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {props.emotions.map((emotion) => (
        <Chip
          key={emotion.id}
          label={props.t(emotionKey(emotion.id))}
          color={theme.palette.tag}
          selected={props.selected.includes(emotion.id)}
          action="add"
          onPress={() => {
            props.onToggle(emotion.id);
          }}
        />
      ))}
    </View>
  );
}
