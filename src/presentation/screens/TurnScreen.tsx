import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmotionShelf } from '../components/EmotionPicker';
import { emotionLabel, emotionTint, idForTypedWord } from '../components/emotionDisplay';
import { FixWording } from '../components/FixWording';
import { moodKey } from '../components/MoodLine';
import { MoodScale } from '../components/MoodScale';
import { toneFor } from '../components/emotionTone';
import { OwnWordField } from '../components/OwnWordField';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';

/** Where a button that carried a typed word goes once the word is in. */
type Onward = 'next' | 'together';

/**
 * The card, asking before it answers.
 *
 * What it offers is a handful of words near what was said (owner's word,
 * 2026-09-30), picked from Vidlun's reading, and the card goes up whole once
 * they are there (owner's word, 2026-10-01) — the processing screen covers
 * the second or two the reading takes. The person's own word is always one
 * tap away. The mood, the tags and the observation stay off the card.
 */
export function TurnScreen(props: {
  readonly transcript: string;
  readonly chosen: readonly string[];
  readonly vocabulary: EmotionVocabulary;
  /** The words offered, nearest first. */
  readonly offered: readonly Emotion[];
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
  readonly onRefine: (parentId: string, childId: string) => void;
  /** Adds a word the person typed; a word already chosen stays chosen. */
  readonly onAddWord: (id: string) => void;
  /** The transcript as the person corrects it — the mishearing's escape hatch. */
  readonly onCorrect: (text: string) => void;
  readonly onNext: () => void;
  /** Goes on to Vidlun's words, already chosen, to choose from together. */
  readonly onTogether: () => void;
  /** The mood on the scale: the person's if they set one, Vidlun's reading if not. */
  readonly mood: number | null;
  readonly onMood: (value: number) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  /** Null while the own-word field is closed; the word so far while open. */
  const [typing, setTyping] = useState<string | null>(null);
  /** A typed word committed by a button, waited for before the card moves on. */
  const [after, setAfter] = useState<{ readonly id: string; readonly to: Onward } | null>(
    null,
  );
  const { chosen, onNext, onTogether } = props;
  const full = chosen.length >= MoodEntry.MAX_EMOTIONS;
  /*
   * "Next" needs a word (owner's word, 2026-09-30): one picked, or one being
   * typed, which the tap commits. Someone with no word goes on through
   * "choose together" instead.
   */
  const answered = chosen.length > 0 || (typing ?? '').trim().length > 0;

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
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{
        paddingTop: top,
        ...sides,
        paddingBottom: 40,
        gap: theme.spacing.md,
      }}
    >
      {/*
        * The one repair only the speaker can make, as a button of its own
        * under the words rather than a pill inside them (owner's word,
        * 2026-10-01). On the card rather than in a step of its own, so the
        * entry that was heard right — most of them — pays nothing for the
        * one that was not.
        */}
      <FixWording
        text={props.transcript}
        t={props.t}
        onFix={props.onCorrect}
        style={{ gap: theme.spacing.sm }}
      >
        <Card tone="quiet">
          <AppText variant="quote">{`«${props.transcript}»`}</AppText>
        </Card>
      </FixWording>

      <AppText variant="display">{props.t('turn.question')}</AppText>
      <AppText variant="secondary" color="inkSoft">
        {props.t('turn.hint')}
      </AppText>

      {/*
        * What has been named, on top and in a box of its own, with no
        * caption over it (owner's word, 2026-10-01): under the offered
        * words it read as more of them. The price is that the list moves
        * down when the first word goes in — the reason it used to sit
        * underneath.
        */}
      {chosen.length === 0 ? null : (
        <View
          style={{
            borderRadius: theme.radii.card,
            borderWidth: 1,
            borderColor: theme.palette.line,
            backgroundColor: theme.palette.paper,
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {chosen.map((id) => (
              <Chip
                key={id}
                label={emotionLabel(id, props.t)}
                color={emotionTint(id, props.vocabulary, theme)}
                action="remove"
                onPress={() => {
                  props.onToggle(id);
                }}
              />
            ))}
          </View>
        </View>
      )}

      <EmotionShelf
        emotions={props.offered}
        vocabulary={props.vocabulary}
        selected={chosen}
        t={props.t}
        onToggle={props.onToggle}
        onRefine={props.onRefine}
      />

      {/* For when none of the offered words has it; a typed word joins the section above. */}
      {full ? null : (
        <OwnWordField
          typing={typing}
          t={props.t}
          onOpen={() => {
            setTyping('');
          }}
          onChange={setTyping}
          onCommit={() => {
            commit();
          }}
          onClose={() => {
            setTyping(null);
          }}
        />
      )}

      {/*
        * The mood, set here rather than on a card of its own (owner's word,
        * 2026-10-01): Vidlun's reading comes already chosen on the scale,
        * and one tap changes it.
        */}
      <View style={{ gap: 2, marginTop: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="caption" color="inkFaint">
            {props.t('compare.mood')}
          </AppText>
          {props.mood === null ? null : (
            <AppText variant="secondary" color={toneFor(props.mood)}>
              {props.t(moodKey(props.mood))}
            </AppText>
          )}
        </View>
        <MoodScale
          value={props.mood}
          onChange={props.onMood}
          accessibilityLabel={props.t('compare.mood')}
        />
      </View>

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        <Button
          label={props.t('turn.next')}
          disabled={after !== null || !answered}
          onPress={() => {
            go('next');
          }}
        />
        {/*
          * Two buttons, one under the other (owner's word, 2026-09-30):
          * going on with one's own words, or asking Vidlun to choose with
          * them. A word still being typed is part of either.
          */}
        <Button
          label={props.t('turn.together')}
          variant="secondary"
          disabled={after !== null}
          onPress={() => {
            go('together');
          }}
        />
      </View>
    </ScrollView>
  );
}
