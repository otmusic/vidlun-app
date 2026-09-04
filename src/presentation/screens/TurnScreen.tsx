import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmotionPicker } from '../components/EmotionPicker';
import { FixWording } from '../components/FixWording';
import { Icon, ICON_SIZE } from '../components/Icon';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The card, asking before it answers.
 *
 * Everything the analysis produced is absent here — not the emotions, not the
 * mood, not the tags, not the observation, and no placeholder whose count
 * would give the answer away. The transcript is the person's own words, so it
 * stays.
 */
export function TurnScreen(props: {
  readonly transcript: string;
  readonly chosen: readonly string[];
  readonly vocabulary: EmotionVocabulary;
  /** True once they have answered and the analysis has not landed yet. */
  readonly holding: boolean;
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
  readonly onRefine: (parentId: string, childId: string) => void;
  /** The transcript as the person corrects it — the mishearing's escape hatch. */
  readonly onCorrect: (text: string) => void;
  readonly onNext: () => void;
  readonly onSkip: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const scheme = theme.isDark ? 'dark' : 'light';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{
        paddingTop: 70,
        paddingHorizontal: 22,
        paddingBottom: 40,
        gap: theme.spacing.md,
      }}
    >
      <AppText variant="caption" color="inkFaint">
        {props.t('turn.eyebrow')}
      </AppText>

      <Card tone="quiet">
        {/*
          * The one repair only the speaker can make. It lives on the card
          * rather than in a step of its own so the entry that was heard
          * right — most of them — pays nothing for the one that was not.
          */}
        <FixWording
          text={props.transcript}
          t={props.t}
          onFix={props.onCorrect}
          style={{ gap: theme.spacing.sm }}
        >
          <AppText variant="quote">{`«${props.transcript}»`}</AppText>
        </FixWording>
      </Card>

      <AppText variant="display">{props.t('turn.question')}</AppText>
      <AppText variant="secondary" color="inkSoft">
        {props.t('turn.hint')}
      </AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {props.chosen.map((id) => {
          const emotion = props.vocabulary.find(id);

          return (
            <Chip
              key={id}
              label={props.t(emotionKey(id))}
              color={
                emotion === undefined
                  ? undefined
                  : colorForEmotion(props.vocabulary, emotion, scheme)
              }
              action="remove"
              onPress={() => {
                props.onToggle(id);
              }}
            />
          );
        })}
        {pickerOpen ? null : (
          <Chip
            label={`+ ${props.t('turn.pick')}`}
            onPress={() => {
              setPickerOpen(true);
            }}
          />
        )}
      </View>

      {pickerOpen ? (
        <EmotionPicker
          vocabulary={props.vocabulary}
          selected={props.chosen}
          t={props.t}
          onToggle={props.onToggle}
          onRefine={props.onRefine}
        />
      ) : null}

      {/*
        * Said out loud, so nobody has to wonder whether the app is holding
        * something back or simply found nothing.
        */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.palette.lineSoft,
          paddingTop: theme.spacing.md,
        }}
      >
        <Icon name="eye-off" size={ICON_SIZE.glyph} color="inkFaint" />
        <AppText variant="secondary" color="inkFaint" style={{ flex: 1 }}>
          {props.t('turn.hidden')}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        {props.holding ? (
          <AppText variant="secondary" color="inkFaint" align="center">
            {props.t('turn.waiting')}
          </AppText>
        ) : null}
        {/*
          * Live even with nothing chosen: silence is an answer, and it is
          * recorded as one rather than as a skipped step.
          */}
        <Button label={props.t('turn.next')} onPress={props.onNext} disabled={props.holding} />
        <Button label={props.t('turn.skip')} variant="ghost" onPress={props.onSkip} />
      </View>
    </ScrollView>
  );
}
