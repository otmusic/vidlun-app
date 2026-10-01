import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { MoodEntry } from '@/domain/entities/MoodEntry';
import { type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { BackButton } from '../components/BackButton';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { emotionLabel, emotionTint, idForTypedWord } from '../components/emotionDisplay';
import { OwnWordField } from '../components/OwnWordField';
import { WaveMark } from '../components/WaveMark';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Choosing together: the words for the entry, Vidlun's already chosen beside
 * whatever the person named on the card (owner's word, 2026-10-01). One list
 * rather than two answers set side by side — a tap takes a word off or puts
 * it back, and a word of one's own is typed in at the end of it.
 *
 * Vidlun's block is a place rather than a colour: its own violet surface, so
 * the accent does not have to mean a second thing.
 */
export function CompareScreen(props: {
  readonly proposed: MoodEntry;
  readonly draft: MoodEntry;
  readonly vocabulary: EmotionVocabulary;
  readonly t: Translate;
  /** Takes a word off the entry or puts it back. */
  readonly onToggle: (id: string) => void;
  /** Adds a word typed here; a word already in stays in. */
  readonly onAddWord: (id: string) => void;
  readonly onConfirm: () => void;
  /** Back to the question card, as it was. */
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const kept = props.draft.emotionIds;
  const { onConfirm } = props;
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
  /** Null while the own-word field is closed; the word so far while open. */
  const [typing, setTyping] = useState<string | null>(null);
  /** A typed word committed by "save", waited for before the entry is written. */
  const [saveAfter, setSaveAfter] = useState<string | null>(null);

  const colorOf = (id: string): string | undefined => emotionTint(id, props.vocabulary, theme);
  const label = (id: string): string => emotionLabel(id, props.t);

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

  // Saved from the render that has the word: the handler reads its own stage.
  useEffect(() => {
    if (saveAfter !== null && kept.includes(saveAfter)) {
      setSaveAfter(null);
      onConfirm();
    }
  }, [kept, onConfirm, saveAfter]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{
        paddingTop: top,
        ...sides,
        paddingBottom: 34,
        gap: 10,
      }}
    >
      <View style={{ marginBottom: 12 }}>
        <BackButton t={props.t} onPress={props.onBack} />
      </View>

      <Block surface={theme.palette.voiceSoft}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Sparkle colour={theme.palette.accentInk} />
          <AppText variant="caption" color="accentInk">
            {props.t(heardNothing ? 'compare.lunaNone' : 'compare.luna')}
          </AppText>
        </View>
        {heardNothing ? (
          /*
           * Not an empty slot but a finding, and one §6 calls correct and
           * common: an entry about what the day held rather than how it felt
           * has no emotion in it to hear.
           */
          <AppText variant="body">{props.t('compare.noneCopy')}</AppText>
        ) : null}
        <Row>
          {offered.map((id) =>
            /*
             * A word in the entry is solid, with the mark that takes it off;
             * one taken off becomes a ring with a plus, and the same tap puts
             * it back. Vidlun's words start in (owner's word, 2026-10-01), so
             * agreeing costs nothing and disagreeing is one tap per word.
             */
            kept.includes(id) ? (
              <Chip
                key={id}
                label={label(id)}
                color={colorOf(id)}
                solid
                action="remove"
                onPress={() => {
                  props.onToggle(id);
                }}
              />
            ) : (
              <Chip
                key={id}
                label={`+ ${label(id)}`}
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
              label={label(id)}
              color={colorOf(id)}
              solid
              action="remove"
              onPress={() => {
                props.onToggle(id);
              }}
            />
          ))}
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
        </Row>
      </Block>

      {heardNothing ? (
        /*
         * The observation would be about a feeling there was none of, so the
         * drawing gives this state its own line instead.
         */
        <Block surface={theme.palette.panel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <WaveMark width={26} color={theme.palette.lime} />
            <AppText variant="caption" color="tileInk">
              {props.t('compare.echo')}
            </AppText>
          </View>
          <AppText variant="quote" color="onPanel">
            {props.t('compare.noneEcho')}
          </AppText>
        </Block>
      ) : props.draft.observation === null ? null : (
        <Block surface={theme.palette.panel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <WaveMark width={26} color={theme.palette.lime} />
            <AppText variant="caption" color="tileInk">
              {props.t('compare.echo')}
            </AppText>
          </View>
          <AppText variant="quote" color="onPanel">
            {props.draft.observation}
          </AppText>
        </Block>
      )}

      {props.draft.contextTags.length > 0 ? (
        <View style={{ gap: 10, marginTop: 4 }}>
          {/* What the entry was about, named so the grey chips are not mistaken for feelings. */}
          <AppText variant="caption" color="inkFaint">
            {props.t('entry.topics')}
          </AppText>
          <Row>
            {props.draft.contextTags.map((tag) => (
              <Chip key={tag} label={tag} tone="neutral" />
            ))}
          </Row>
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        {/* A word still being typed is part of the entry, so it goes in first. */}
        <Button
          label={props.t('reflection.confirm')}
          disabled={saveAfter !== null}
          onPress={() => {
            const added = commit();

            if (added === null) {
              onConfirm();
            } else {
              setSaveAfter(added);
            }
          }}
        />
      </View>
    </ScrollView>
  );
}

function unique(ids: readonly string[]): readonly string[] {
  return ids.filter((id, at) => ids.indexOf(id) === at);
}

function Block(props: {
  readonly children: React.ReactNode;
  readonly bordered?: boolean;
  readonly surface?: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        borderRadius: 20,
        padding: 18,
        gap: 12,
        backgroundColor: props.surface ?? (props.bordered === true ? theme.palette.paper : 'transparent'),
        borderWidth: props.bordered === true ? 1 : 0,
        borderColor: theme.palette.line,
      }}
    >
      {props.children}
    </View>
  );
}

function Row(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{props.children}</View>
  );
}

/** The drawing's four-point star beside "Vidlun heard". */
function Sparkle(props: { readonly colour: string }): React.JSX.Element {
  return (
    <Svg viewBox="0 0 24 24" width={13} height={13}>
      <Path
        d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"
        fill={props.colour}
      />
    </Svg>
  );
}
