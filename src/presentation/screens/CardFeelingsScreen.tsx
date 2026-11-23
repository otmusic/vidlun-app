import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { OWN_WORD_MAX_LENGTH } from '@/domain/entities/OwnWord';
import { emotionKey, type Locale, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { CardHeader } from '../components/CardHeader';
import { CardPage } from '../components/CardPage';
import { Chip } from '../components/Chip';
import { AddPill, ChipField } from '../components/ChipField';
import { emotionLabel, emotionWordsIn, idForTypedWord } from '../components/emotionDisplay';
import { useTheme } from '../theme/ThemeProvider';

type Onward = 'next' | 'together';

/**
 * The card's second step: what the person feels, named before Vidlun answers
 * (owner's word, 2026-11-23). One row: the words nearest to what was said,
 * a chosen one filled where it stands with the mark that takes it off, a
 * word of one's own after them, and the "+ add an emotion" pill (named as in production)
 * opening into a chip typed in place. The separate box of chosen words above
 * the list is gone: it said the same words twice.
 *
 * "Choose a mood" (named for where it goes, owner's word 2026-11-23) needs a
 * word (owner's word, 2026-09-30): one picked, or one being typed, which the
 * tap commits. Someone with no word goes on through
 * "choose together" instead — and coming back from it with none is an
 * answer, given with Vidlun's words in sight.
 */
export function CardFeelingsScreen(props: {
  readonly transcript: string;
  readonly createdAt: Date;
  readonly chosen: readonly string[];
  readonly vocabulary: EmotionVocabulary;
  /** The words offered, nearest first. */
  readonly offered: readonly Emotion[];
  /** True once choosing together brought its words back to the card. */
  readonly choseTogether: boolean;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
  /** Adds a word the person typed; a word already chosen stays chosen. */
  readonly onAddWord: (id: string) => void;
  readonly onNext: () => void;
  /** Goes on to Vidlun's words, already chosen, to choose from together. */
  readonly onTogether: () => void;
  readonly onBack: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { chosen, onNext, onTogether, t } = props;
  // The words beside the sentence are in the language it was said in.
  const words = emotionWordsIn(props.transcript, t);
  const full = chosen.length >= MoodEntry.MAX_EMOTIONS;
  /** Null while the own-word chip is closed; the word so far while open. */
  const [typing, setTyping] = useState<string | null>(null);
  /** A typed word committed by a button, waited for before the card moves on. */
  const [after, setAfter] = useState<{ readonly id: string; readonly to: Onward } | null>(null);
  const answered = chosen.length > 0 || (typing ?? '').trim().length > 0 || props.choseTogether;
  const offeredIds = props.offered.map((emotion) => emotion.id);
  // A word of one's own, or one chosen together, stands after the offered ones, chosen.
  const others = chosen.filter((id) => !offeredIds.includes(id));

  /** Adds the word being typed, if any; returns its id when it is new. */
  const commit = (): string | null => {
    const id = typing === null ? null : idForTypedWord(typing, props.vocabulary);

    setTyping(null);

    if (id === null || chosen.includes(id) || full) {
      return null;
    }

    props.onAddWord(id);

    return id;
  };

  /*
   * Called from here rather than from the tap: the card's handlers read the
   * stage they were made with, and only the render after the word went in
   * holds one that has it.
   */
  useEffect(() => {
    if (after !== null && chosen.includes(after.id)) {
      setAfter(null);

      if (after.to === 'next') {
        onNext();
      } else {
        onTogether();
      }
    }
  }, [after, chosen, onNext, onTogether]);

  /** A word still being typed is part of the answer, so it goes in first. */
  const go = (to: Onward): void => {
    const added = commit();

    if (added !== null) {
      setAfter({ id: added, to });
    } else if (to === 'next') {
      onNext();
    } else {
      onTogether();
    }
  };

  return (
    <CardPage
      footer={
        <>
          <Button
            label={t('card.chooseMood')}
            disabled={after !== null || !answered}
            onPress={() => {
              go('next');
            }}
          />
          <Button
            label={t('turn.together')}
            variant="secondary"
            disabled={after !== null}
            onPress={() => {
              go('together');
            }}
          />
        </>
      }
    >
      <CardHeader
        step={2}
        createdAt={props.createdAt}
        locale={props.locale}
        t={t}
        onBack={props.onBack}
        onDiscard={props.onDiscard}
      />

      <AppText variant="display">{t('turn.question')}</AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        {props.offered.map((emotion) => {
          const picked = chosen.includes(emotion.id);

          return (
            <Chip
              key={emotion.id}
              label={words(emotionKey(emotion.id))}
              color={theme.palette.tag}
              selected={picked}
              action={picked ? 'remove' : 'add'}
              onPress={() => {
                props.onToggle(emotion.id);
              }}
            />
          );
        })}
        {others.map((id) => (
          <Chip
            key={id}
            label={emotionLabel(id, words)}
            color={theme.palette.tag}
            selected
            action="remove"
            onPress={() => {
              props.onToggle(id);
            }}
          />
        ))}
        {typing === null ? null : (
          <ChipField
            value={typing}
            placeholder={t('card.emotionPlaceholder')}
            label={t('turn.ownWord')}
            maxLength={OWN_WORD_MAX_LENGTH}
            autoCapitalize="sentences"
            onChange={setTyping}
            onCommit={() => {
              commit();
            }}
          />
        )}
        {typing !== null || full ? null : (
          <AddPill
            label={t('turn.ownWord')}
            onPress={() => {
              setTyping('');
            }}
          />
        )}
      </View>
    </CardPage>
  );
}
