import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EntryEdits } from '@/domain/entities/MoodEntry';
import { MoodScore } from '@/domain/value-objects/MoodScore';
import { emotionKey, type Translate, type TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EMOTION_GROUPS, groupOf, type EmotionGroup } from '../components/emotionTone';
import { colorForEmotion } from '../theme/emotionColor';
import { MoodScale } from '../components/MoodScale';
import { useTheme } from '../theme/ThemeProvider';

export interface EditScreenProps {
  readonly draft: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
  readonly onDone: (edits: EntryEdits) => void;
}

const GROUP_LABELS: Record<EmotionGroup, TranslationKey> = {
  pleasantCalm: 'edit.groupPleasantCalm',
  pleasantEnergetic: 'edit.groupPleasantEnergetic',
  tense: 'edit.groupTense',
  heavy: 'edit.groupHeavy',
};

export function EditScreen(props: EditScreenProps): React.JSX.Element {
  const theme = useTheme();
  const [transcript, setTranscript] = useState(props.draft.cleanTranscript);
  /*
   * Null until the person picks one. An entry that never said how the day was
   * arrives here empty rather than pre-filled with a three — offering a number
   * nobody gave and calling it theirs is the thing this whole change is about.
   */
  const [mood, setMood] = useState<number | null>(props.draft.mood?.value ?? null);
  const [emotionIds, setEmotionIds] = useState<readonly string[]>(props.draft.emotionIds);
  const [tags, setTags] = useState<readonly string[]>(props.draft.contextTags);

  const atLimit = emotionIds.length >= MoodEntry.MAX_EMOTIONS;

  const toggle = (id: string): void => {
    setEmotionIds((current) =>
      current.includes(id)
        ? current.filter((each) => each !== id)
        : current.length >= MoodEntry.MAX_EMOTIONS
          ? current
          : [...current, id],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 64, gap: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="display">{props.t('edit.title')}</AppText>
          <Button
            label={props.t('edit.done')}
            style={{ paddingHorizontal: theme.spacing.md }}
            onPress={() => {
              props.onDone({
                cleanTranscript: transcript,
                // Still null if they did not pick one: editing an entry is not
                // an occasion to make somebody rate a day they did not rate.
                mood: mood === null ? null : MoodScore.of(mood),
                emotionIds,
                contextTags: tags,
              });
            }}
          />
        </View>

        <AppText variant="caption" color="inkFaint">
          {props.t('edit.transcript')}
        </AppText>
        <TextInput
          value={transcript}
          onChangeText={setTranscript}
          multiline
          style={{
            ...theme.type.quote,
            color: theme.palette.ink,
            backgroundColor: theme.palette.lineSoft,
            borderRadius: theme.radii.card,
            padding: theme.spacing.md,
          }}
        />

        <AppText variant="caption" color="inkFaint">
          {props.t('edit.mood')}
        </AppText>
        <MoodScale
          value={mood}
          onChange={setMood}
          lowLabel={props.t('edit.moodLow')}
          highLabel={props.t('edit.moodHigh')}
          accessibilityLabel={props.t('edit.mood')}
        />

        <AppText variant="caption" color="inkFaint">
          {`${props.t('edit.selected')} · ${props.t('edit.tapToRemove')}`}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {emotionIds.map((id) => {
            const emotion = props.vocabulary.find(id);

            return (
              <Chip
                key={id}
                label={props.t(emotionKey(id))}
                color={
                  emotion === undefined
                    ? undefined
                    : colorForEmotion(props.vocabulary, emotion, theme.isDark ? 'dark' : 'light')
                }
                action="remove"
                onPress={() => {
                  toggle(id);
                }}
              />
            );
          })}
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.palette.lineSoft,
            paddingTop: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="caption" color="inkFaint">
            {props.t('edit.addEmotion')}
          </AppText>
          {atLimit ? (
            <AppText variant="secondary" color="inkFaint">
              {props.t('edit.limitReached')}
            </AppText>
          ) : null}
          {EMOTION_GROUPS.map((group) => (
            <EmotionGroupSection
              key={group}
              group={group}
              vocabulary={props.vocabulary}
              selected={emotionIds}
              t={props.t}
              onToggle={toggle}
            />
          ))}
        </View>

        {tags.length > 0 ? (
          <>
            <AppText variant="caption" color="inkFaint">
              {props.t('edit.context')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  tone="neutral"
                  action="remove"
                  onPress={() => {
                    setTags((current) => current.filter((each) => each !== tag));
                  }}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Only the top two levels are offered here. The third level is reachable but
 * long, and a picker that lists everything is a form — which is the one thing
 * this product is not.
 */
function EmotionGroupSection(props: {
  readonly group: EmotionGroup;
  readonly vocabulary: EmotionVocabulary;
  readonly selected: readonly string[];
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
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
            color={colorForEmotion(props.vocabulary, emotion, theme.isDark ? 'dark' : 'light')}
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
