import { View } from 'react-native';

import type { Translate, TranslationKey } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { toneFor } from './emotionTone';

const MOOD_LABELS: readonly TranslationKey[] = ['mood.1', 'mood.2', 'mood.3', 'mood.4', 'mood.5'];

/** The word for a point on the scale, "very low" to "high". */
export function moodKey(value: number): TranslationKey {
  return MOOD_LABELS[value - 1] ?? 'mood.3';
}

/**
 * The mood as a word in its colour — a category, not a reading on a scale
 * (owner's word, 2026-09-30): no ring filling up, no "4 of 5". The colour is
 * the mood scale's own (§7.1) and never carries it alone: the word is there.
 *
 * One line, its name beside it rather than over it, and no card around it
 * (owner's word, 2026-10-01): the card gave one word the room of a paragraph.
 */
export function MoodLine(props: { readonly value: number; readonly t: Translate }): React.JSX.Element {
  const theme = useTheme();
  const tone = toneFor(props.value);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <AppText variant="caption" color="inkFaint">
        {props.t('compare.mood')}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.palette[tone] }}
        />
        <AppText variant="body" color={tone}>
          {props.t(moodKey(props.value))}
        </AppText>
      </View>
    </View>
  );
}
