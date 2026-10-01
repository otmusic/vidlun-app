import { View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { type Translate } from '@/i18n';

import { AppText } from './AppText';
import { Chip } from './Chip';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, emotionTint } from './emotionDisplay';

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
    <View style={{ gap: theme.spacing.md }}>
      {props.entry.hasEmotions ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {props.entry.emotionIds.map((id) => (
            <Chip
              key={id}
              label={emotionLabel(id, props.t)}
              color={emotionTint(id, props.vocabulary, theme)}
            />
          ))}
        </View>
      ) : (
        <AppText variant="secondary" color="inkFaint">
          {props.t('reflection.noEmotions')}
        </AppText>
      )}
      {/*
        * The tags are what the entry was about, not feelings, and a row of
        * grey chips beside the coloured ones read as more feelings (owner's
        * word, 2026-09-30) — so they sit apart, under their own name.
        */}
      {props.entry.contextTags.length === 0 ? null : (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="secondary" color="inkSoft">
            {props.t('entry.topics')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {props.entry.contextTags.map((tag) => (
              <Chip key={tag} label={tag} tone="neutral" />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
