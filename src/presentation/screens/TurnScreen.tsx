import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button, TapTarget } from '../components/Button';
import { Card } from '../components/Card';
import { CardTopics } from '../components/CardTopics';
import { Chip } from '../components/Chip';
import { EmotionShelf } from '../components/EmotionPicker';
import { emotionLabel, emotionTint, emotionWordsIn, idForTypedWord } from '../components/emotionDisplay';
import { FixWording } from '../components/FixWording';
import { Icon, ICON_SIZE } from '../components/Icon';
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
 * tap away. The mood sits on the scale and the topics under the words
 * (owner's word, 2026-10-01); the observation stays off the card.
 */
export function TurnScreen(props: {
  readonly transcript: string;
  readonly chosen: readonly string[];
  readonly vocabulary: EmotionVocabulary;
  /** The words offered, nearest first. */
  readonly offered: readonly Emotion[];
  readonly t: Translate;
  readonly onToggle: (id: string) => void;
  /** Adds a word the person typed; a word already chosen stays chosen. */
  readonly onAddWord: (id: string) => void;
  /** The transcript as the person corrects it — the mishearing's escape hatch. */
  readonly onCorrect: (text: string) => void;
  readonly onNext: () => void;
  /** Goes on to Vidlun's words, already chosen, to choose from together. */
  readonly onTogether: () => void;
  /** True once choosing together brought its words back to the card. */
  readonly choseTogether: boolean;
  /** The mood on the scale: the person's if they set one, Vidlun's reading if not. */
  readonly mood: number | null;
  readonly onMood: (value: number) => void;
  /** What the entry was about, as Vidlun read it. */
  readonly topics: readonly string[];
  /** The topics taken off the card, still shown so the same tap puts one back. */
  readonly droppedTopics: readonly string[];
  /** The topics the person wrote in (owner's word, 2026-11-23). */
  readonly addedTopics: readonly string[];
  readonly onToggleTopic: (tag: string) => void;
  readonly onAddTopic: (typed: string) => void;
  /** The topic line opened: the journal's topics are read, for the spelling a typed one is saved with. */
  readonly onOpenTopic: () => void;
  /** Throws the entry away unsaved, once the person has said yes. */
  readonly onDiscard: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  // The words beside the sentence are in the language it was said in.
  const words = emotionWordsIn(props.transcript, props.t);
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  /** Null while the own-word field is closed; the word so far while open. */
  const [typing, setTyping] = useState<string | null>(null);
  /**
   * The topic being written in, null while its line is closed. Mirrored in a
   * ref and cleared the moment it is used: the line commits on return and
   * then blurs, and "next" commits it and then unmounts it, and neither may
   * write the same topic in twice.
   */
  const [topicTyping, setTopicTyping] = useState<string | null>(null);
  const topicTyped = useRef<string | null>(null);
  /** Where the card goes once a topic committed by a button is in the stage. */
  const [onward, setOnward] = useState<Onward | null>(null);
  /** A typed word committed by a button, waited for before the card moves on. */
  const [after, setAfter] = useState<{ readonly id: string; readonly to: Onward } | null>(
    null,
  );
  const { chosen, onNext, onTogether } = props;
  const full = chosen.length >= MoodEntry.MAX_EMOTIONS;
  /*
   * "Next" needs a word (owner's word, 2026-09-30): one picked, or one being
   * typed, which the tap commits. Someone with no word goes on through
   * "choose together" instead — and coming back from it with none is an
   * answer, given with Vidlun's words in sight.
   */
  const answered = chosen.length > 0 || (typing ?? '').trim().length > 0 || props.choseTogether;

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

  const confirmDiscard = (): void => {
    Alert.alert(props.t('delete.title'), props.t('delete.body'), [
      { text: props.t('delete.cancel'), style: 'cancel' },
      { text: props.t('delete.confirm'), style: 'destructive', onPress: props.onDiscard },
    ]);
  };

  const typeTopic = (text: string | null): void => {
    topicTyped.current = text;
    setTopicTyping(text);
  };

  /** Writes in the topic being typed, if any; true when one went to the stage. */
  const commitTopic = (): boolean => {
    const text = topicTyped.current;

    typeTopic(null);

    if (text === null || text.trim().length === 0) {
      return false;
    }

    props.onAddTopic(text);

    return true;
  };

  // The render after a topic went in holds a stage that has it; go on from there.
  useEffect(() => {
    if (onward !== null) {
      setOnward(null);

      if (onward === 'next') {
        onNext();
      } else {
        onTogether();
      }
    }
  }, [onward, onNext, onTogether]);

  /** A word or a topic still being typed is part of the answer, so it goes in first. */
  const go = (to: Onward): void => {
    const topicWent = commitTopic();
    const added = commit();

    if (added !== null) {
      setAfter({ id: added, to });
    } else if (topicWent) {
      setOnward(to);
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
        * The way out of an entry not yet saved (owner's word, 2026-11-19):
        * the same red bin as a saved entry's page, and it asks first in the
        * same words. Nothing of the entry is kept, the voice included.
        */}
      {/* 22pt down to the words, as from the back button on choosing together. */}
      <View style={{ alignItems: 'flex-end', marginBottom: 22 - theme.spacing.md }}>
        <TapTarget onPress={confirmDiscard} accessibilityLabel={props.t('detail.delete')}>
          <Icon name="trash-2" size={ICON_SIZE.action} color="danger" />
        </TapTarget>
      </View>

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
          <AppText variant="quote">{props.t('common.quoted', { text: props.transcript })}</AppText>
          {/*
            * What the entry was about, under the words it was read from, and
            * the one place its topics change: taken off, put back, or written
            * in where Vidlun missed one (owner's word, 2026-10-01 and
            * 2026-11-23). Shown with no topics too, for the one to write in.
            */}
          <CardTopics
            topics={{ proposed: props.topics, dropped: props.droppedTopics, added: props.addedTopics }}
            typing={topicTyping}
            t={props.t}
            onToggle={props.onToggleTopic}
            onOpen={() => {
              typeTopic('');
              props.onOpenTopic();
            }}
            onChange={typeTopic}
            onCommit={() => {
              commitTopic();
            }}
          />
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
                label={emotionLabel(id, words)}
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
        selected={chosen}
        t={words}
        onToggle={props.onToggle}
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
          disabled={after !== null || onward !== null || !answered}
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
          disabled={after !== null || onward !== null}
          onPress={() => {
            go('together');
          }}
        />
      </View>
    </ScrollView>
  );
}
