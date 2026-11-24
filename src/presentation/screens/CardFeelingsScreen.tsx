import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

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
import { Sparkle, TogetherSheet } from '../components/TogetherSheet';
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
 * tap commits. Someone with no word opens "choose together" instead — and
 * going on from it with none is an answer, given with Vidlun's words in
 * sight.
 *
 * "Choose together" sits under the words it is about, not under "choose a
 * mood", where it read as choosing the mood together (owner's word,
 * 2026-11-24). It opens a sheet of Vidlun's words rather than a page, and it
 * is only there while Vidlun has words to offer: when it heard no clear
 * emotion, or could not listen, there is no button, and "choose a mood" goes
 * on without a word, since no word is an answer too (§6).
 */
export function CardFeelingsScreen(props: {
  readonly transcript: string;
  readonly createdAt: Date;
  readonly chosen: readonly string[];
  readonly vocabulary: EmotionVocabulary;
  /** The words offered, nearest first. */
  readonly offered: readonly Emotion[];
  /** Vidlun's words, for choosing together; empty when it heard none, or could not listen. */
  readonly heard: readonly string[];
  /** True once choosing together has shown Vidlun's words. */
  readonly sawTogether: boolean;
  /** True once choosing together put its words on the card, and its way is gone. */
  readonly tookTogether: boolean;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
  /** Adds a word the person typed; a word already chosen stays chosen. */
  readonly onAddWord: (id: string) => void;
  readonly onNext: () => void;
  /** Choosing together opened: what is named by now is the unaided answer. */
  readonly onOpenTogether: () => void;
  /** "Choose" in its sheet: these of Vidlun's words join the card's. */
  readonly onChooseTogether: (ids: readonly string[]) => void;
  readonly onBack: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { chosen, onNext, onOpenTogether, t } = props;
  // The words beside the sentence are in the language it was said in.
  const words = emotionWordsIn(props.transcript, t);
  const full = chosen.length >= MoodEntry.MAX_EMOTIONS;
  /** Null while the own-word chip is closed; the word so far while open. */
  const [typing, setTyping] = useState<string | null>(null);
  /** A typed word committed by a button, waited for before the card moves on. */
  const [after, setAfter] = useState<{ readonly id: string; readonly to: Onward } | null>(null);
  /** Whether the sheet of Vidlun's words is up. */
  const [sheet, setSheet] = useState(false);
  const canChooseTogether = props.heard.length > 0 && !props.tookTogether;
  const answered =
    chosen.length > 0 ||
    (typing ?? '').trim().length > 0 ||
    props.sawTogether ||
    // With nothing of Vidlun's to choose from, no word is the answer (owner's word, 2026-11-24).
    !canChooseTogether;
  const openTogether = useCallback((): void => {
    onOpenTogether();
    setSheet(true);
  }, [onOpenTogether]);
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
        openTogether();
      }
    }
  }, [after, chosen, onNext, openTogether]);

  /** A word still being typed is part of the answer, so it goes in first. */
  const go = (to: Onward): void => {
    const added = commit();

    if (added !== null) {
      setAfter({ id: added, to });
    } else if (to === 'next') {
      onNext();
    } else {
      openTogether();
    }
  };

  return (
    <CardPage
      footer={
        <Button
          label={t('card.chooseMood')}
          disabled={after !== null || !answered}
          onPress={() => {
            go('next');
          }}
        />
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

      {canChooseTogether ? (
        <Pressable
          accessibilityRole="button"
          disabled={after !== null}
          onPress={() => {
            go('together');
          }}
          style={({ pressed }) => ({
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            minHeight: 44,
            marginTop: 14,
            paddingHorizontal: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Sparkle colour={theme.palette.accentInk} size={14} />
          <AppText variant="label" color="accentInk">
            {t('turn.together')}
          </AppText>
        </Pressable>
      ) : null}

      <TogetherSheet
        open={sheet}
        heard={props.heard}
        words={words}
        t={t}
        onChoose={(ids) => {
          setSheet(false);
          props.onChooseTogether(ids);
        }}
        onClose={() => {
          setSheet(false);
        }}
      />
    </CardPage>
  );
}
