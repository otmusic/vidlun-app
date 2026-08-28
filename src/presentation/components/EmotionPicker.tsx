import { useState } from 'react';
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
 * Two levels are on the shelves; the third arrives one word at a time. Listing
 * all 125 would make this a form, which is the one thing this product is not,
 * but leaving the deepest words unreachable would make the granularity metric
 * measure our ceiling instead of the person's vocabulary — so a chosen word
 * offers its own children and nothing else.
 */
export function EmotionPicker(props: {
  readonly vocabulary: EmotionVocabulary;
  readonly selected: readonly string[];
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
  /**
   * Swaps a chosen word for one of its children. A replacement rather than a
   * second pick: "lonely, and more precisely abandoned" is one feeling named
   * twice, and spending two of the four slots on it would say otherwise.
   */
  readonly onRefine: (parentId: string, childId: string) => void;
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
  readonly onRefine: (parentId: string, childId: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const scheme = theme.isDark ? 'dark' : 'light';
  /** Which chosen word is showing its children. One at a time, or it is a form. */
  const [opened, setOpened] = useState<string | null>(null);
  const offered = props.vocabulary
    .all()
    .filter((emotion: Emotion) => emotion.depth <= 2 && groupOf(emotion) === props.group);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" color="inkFaint">
        {props.t(GROUP_LABELS[props.group])}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {offered.map((emotion) => {
          const chosen = props.selected.includes(emotion.id);
          const children = props.vocabulary.childrenOf(emotion.id);

          return (
            <Chip
              key={emotion.id}
              label={props.t(emotionKey(emotion.id))}
              color={colorForEmotion(props.vocabulary, emotion, scheme)}
              selected={chosen}
              action="add"
              onPress={() => {
                /*
                 * A word that is not chosen yet is chosen by this tap, and one
                 * with nothing under it is let go by it. Only a chosen word
                 * that has children does something else: the first tap offers
                 * them, and the second lets the word go, so nothing that was
                 * possible before this became unreachable.
                 */
                if (!chosen || children.length === 0) {
                  setOpened(null);
                  props.onToggle(emotion.id);

                  return;
                }

                if (opened === emotion.id) {
                  setOpened(null);
                  props.onToggle(emotion.id);

                  return;
                }

                setOpened(emotion.id);
              }}
            />
          );
        })}
      </View>
      {opened === null ? null : (
        <Refinement
          parentId={opened}
          vocabulary={props.vocabulary}
          t={props.t}
          onPick={(childId) => {
            setOpened(null);
            props.onRefine(opened, childId);
          }}
        />
      )}
    </View>
  );
}

/**
 * One word's children and nothing else. Quiet on purpose: it is an offer to be
 * more exact, not a question anyone has to answer, and §6 leans on this same
 * drill-down for the sensitive words the analyzer is never allowed to propose.
 */
function Refinement(props: {
  readonly parentId: string;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
  readonly onPick: (childId: string) => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const scheme = theme.isDark ? 'dark' : 'light';
  const children = props.vocabulary.childrenOf(props.parentId);

  if (children.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: theme.spacing.xs, paddingLeft: theme.spacing.sm }}>
      <AppText variant="secondary" color="inkFaint">
        {props.t('edit.refine')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {children.map((child: Emotion) => (
          <Chip
            key={child.id}
            label={props.t(emotionKey(child.id))}
            color={colorForEmotion(props.vocabulary, child, scheme)}
            action="add"
            onPress={() => {
              props.onPick(child.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}
