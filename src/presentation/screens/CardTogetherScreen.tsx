import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { OWN_WORD_MAX_LENGTH } from '@/domain/entities/OwnWord';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { CardHeader } from '../components/CardHeader';
import { CardPage } from '../components/CardPage';
import { Chip } from '../components/Chip';
import { AddPill, ChipField } from '../components/ChipField';
import { emotionLabel, emotionTint, emotionWordsIn, idForTypedWord } from '../components/emotionDisplay';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Choosing together, the card's second step taken the other way (owner's
 * word, 2026-11-23): only the emotions — the words Vidlun heard, already
 * chosen, beside whatever the person named before asking — and the way to
 * add one's own. No other offers, no topics and no mood: those have steps of
 * their own. A tap takes a word off and the same tap puts it back, so
 * agreeing costs nothing and disagreeing is one tap per word.
 *
 * "Choose a mood" goes on to the mood, with the words chosen here.
 */
export function CardTogetherScreen(props: {
  readonly proposed: MoodEntry;
  readonly draft: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly t: Translate;
  /** Takes a word off the entry or puts it back. */
  readonly onToggle: (id: string) => void;
  /** Adds a word typed here; a word already in stays in. */
  readonly onAddWord: (id: string) => void;
  /** On to the mood with the words chosen here. */
  readonly onNext: () => void;
  /** Back to the card's question, as it was. */
  readonly onBack: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t, onNext } = props;
  const kept = props.draft.emotionIds;
  /** §6 calls an empty proposal correct and common; the drawing gives it a state. */
  const heardNothing = props.proposed.emotionIds.length === 0;
  /*
   * The person's own words first — named before Vidlun answered — then
   * Vidlun's. The list holds still while words go off and on; only a word
   * typed here joins it at the end, and leaves it when taken off.
   */
  const offered = unique([...props.draft.selfEmotionIds, ...props.proposed.emotionIds]);
  const typedHere = kept.filter((id) => !offered.includes(id));
  const full = kept.length >= MoodEntry.MAX_EMOTIONS;
  /** Null while the own-word chip is closed; the word so far while open. */
  const [typing, setTyping] = useState<string | null>(null);
  /** A typed word committed by the button, waited for before going on. */
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  // In the language the entry was said in, as on the card's question.
  const words = emotionWordsIn(props.draft.cleanTranscript, t);
  const colorOf = (id: string): string | undefined => emotionTint(id, props.vocabulary, theme);

  /** Adds the word being typed, if any; returns its id when it is new. */
  const commit = (): string | null => {
    const id = typing === null ? null : idForTypedWord(typing, props.vocabulary);

    setTyping(null);

    if (id === null || kept.includes(id) || full) {
      return null;
    }

    props.onAddWord(id);

    return id;
  };

  // Kept from the render that has the word: the handler reads its own stage.
  useEffect(() => {
    if (nextAfter !== null && kept.includes(nextAfter)) {
      setNextAfter(null);
      onNext();
    }
  }, [kept, nextAfter, onNext]);

  return (
    <CardPage
      footer={
        <Button
          label={t('card.chooseMood')}
          disabled={nextAfter !== null}
          onPress={() => {
            const added = commit();

            if (added === null) {
              onNext();
            } else {
              setNextAfter(added);
            }
          }}
        />
      }
    >
      <CardHeader
        step={2}
        createdAt={props.draft.createdAt}
        locale={props.locale}
        t={t}
        onBack={props.onBack}
        onDiscard={props.onDiscard}
      />

      <AppText variant="display">{t('card.together')}</AppText>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Sparkle colour={theme.palette.accentInk} />
        <AppText variant="caption" color="accentInk">
          {t(heardNothing ? 'compare.lunaNone' : 'compare.luna')}
        </AppText>
      </View>
      {heardNothing ? (
        /*
         * Not an empty slot but a finding, and one §6 calls correct and
         * common: an entry about what the day held rather than how it felt
         * has no emotion in it to hear.
         */
        <AppText variant="body">{t('compare.noneCopy')}</AppText>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        {offered.map((id) =>
          kept.includes(id) ? (
            <Chip
              key={id}
              label={emotionLabel(id, words)}
              color={colorOf(id)}
              selected
              action="remove"
              onPress={() => {
                props.onToggle(id);
              }}
            />
          ) : (
            <Chip
              key={id}
              label={`+ ${emotionLabel(id, words)}`}
              color={colorOf(id)}
              onPress={() => {
                props.onToggle(id);
              }}
            />
          ),
        )}
        {typedHere.map((id) => (
          <Chip
            key={id}
            label={emotionLabel(id, words)}
            color={colorOf(id)}
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

function unique(ids: readonly string[]): readonly string[] {
  return ids.filter((id, at) => ids.indexOf(id) === at);
}

function Sparkle(props: { readonly colour: string }): React.JSX.Element {
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
      <Path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" fill={props.colour} />
    </Svg>
  );
}
