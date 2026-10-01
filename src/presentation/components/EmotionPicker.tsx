import { useState } from 'react';
import { View } from 'react-native';

import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Translate } from '@/i18n';

import { AppText } from './AppText';
import { Chip } from './Chip';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A handful of emotion words as chips, in the order they are given — no
 * shelves and no shelf names (owner's word, 2026-09-30): the question card
 * offers the words nearest to what was said, and the person types their own
 * when none fits.
 *
 * The third level arrives one word at a time: a chosen word offers its own
 * children and nothing else, so the deepest words stay reachable and the
 * granularity metric measures the person's vocabulary rather than our list.
 */
export function EmotionShelf(props: {
  readonly emotions: readonly Emotion[];
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
  /** Which chosen word is showing its children. One at a time, or it is a form. */
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {props.emotions.map((emotion) => {
          const chosen = props.selected.includes(emotion.id);
          const children = props.vocabulary.childrenOf(emotion.id);

          return (
            <Chip
              key={emotion.id}
              label={props.t(emotionKey(emotion.id))}
              color={theme.palette.tag}
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
                if (!chosen || children.length === 0 || opened === emotion.id) {
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
            color={theme.palette.tag}
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
