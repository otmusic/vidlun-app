import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { CardTopics as Topics } from '@/domain/entities/Topic';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { CardHeader } from '../components/CardHeader';
import { CardPage } from '../components/CardPage';
import { CardTopics } from '../components/CardTopics';
import { Icon } from '../components/Icon';
import { Playback } from '../components/Playback';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The card's first step (owner's word, 2026-11-23; the canvas page with the
 * card's final flow): what was heard, whole and unshortened, with the voice to
 * play it back when it was said, and what it was about. The words are the
 * one thing the person can check and the model cannot, so the repair sits
 * by their heading as a small labelled pill (the owner's pick of four
 * places): a pencil alone was easy to miss, and a whole-width button stood
 * a second large button over the way on.
 *
 * The topics are changed here and only here, before saving. A topic still
 * being typed goes in when the person goes on.
 */
export function CardWordsScreen(props: {
  readonly transcript: string;
  readonly createdAt: Date;
  /** The take, while it can still be played; null for an entry that was typed. */
  readonly take: string | null;
  readonly topics: Topics;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onCorrect: (text: string) => void;
  readonly onToggleTopic: (topic: string) => void;
  readonly onAddTopic: (typed: string) => void;
  /** The topic chip opened: the journal's topics are read, for the spelling a typed one is saved with. */
  readonly onOpenTopic: () => void;
  readonly onNext: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t, onNext } = props;
  /** Null while reading; the text being fixed while fixing. */
  const [fixing, setFixing] = useState<string | null>(null);
  /*
   * The topic being written in, null while its chip is closed. Mirrored in a
   * ref and cleared the moment it is used: the chip commits on return and
   * then blurs, and going on commits it and then unmounts it, and neither
   * may write the same topic in twice.
   */
  const [topicTyping, setTopicTyping] = useState<string | null>(null);
  const topicTyped = useRef<string | null>(null);
  /** Set when a topic was committed by the button: the next render, which has it, goes on. */
  const [goingOn, setGoingOn] = useState(false);

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

  useEffect(() => {
    if (goingOn) {
      setGoingOn(false);
      onNext();
    }
  }, [goingOn, onNext]);

  return (
    <CardPage
      footer={
        <Button
          label={t('card.chooseEmotion')}
          // The repair is finished or abandoned first: the words go on as they stand.
          disabled={fixing !== null || goingOn}
          onPress={() => {
            if (commitTopic()) {
              setGoingOn(true);
            } else {
              onNext();
            }
          }}
        />
      }
    >
      <CardHeader step={1} createdAt={props.createdAt} locale={props.locale} t={t} onDiscard={props.onDiscard} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <AppText variant="display" style={{ flexShrink: 1 }}>
          {t('card.words')}
        </AppText>
        {fixing === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('detail.fix')}
            hitSlop={6}
            onPress={() => {
              setFixing(props.transcript);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 36,
              borderWidth: 1,
              borderColor: theme.palette.line,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.palette.paper,
              paddingLeft: 12,
              paddingRight: 14,
            }}
          >
            <Icon name="edit-3" size={15} color="ink" />
            <AppText variant="label" style={{ fontSize: 14 }}>
              {t('card.fix')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View
        style={{
          borderRadius: theme.radii.card,
          backgroundColor: theme.palette.lineSoft,
          paddingVertical: 18,
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        {props.take === null ? null : <Playback uri={props.take} t={t} variant="inline" />}
        {fixing === null ? (
          <AppText variant="quote" style={{ fontSize: 17, lineHeight: 27 }}>
            {t('common.quoted', { text: props.transcript })}
          </AppText>
        ) : (
          <View style={{ gap: 10 }}>
            <TextInput
              value={fixing}
              onChangeText={setFixing}
              multiline
              autoFocus
              accessibilityLabel={t('detail.fix')}
              style={{
                ...theme.type.quote,
                minHeight: 5 * 25,
                color: theme.palette.ink,
                backgroundColor: theme.palette.paper,
                borderWidth: 1.5,
                borderColor: theme.palette.ink,
                borderRadius: 20,
                paddingVertical: 16,
                paddingHorizontal: 18,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  const text = fixing;

                  setFixing(null);
                  props.onCorrect(text);
                }}
                style={{
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.palette.solid,
                  paddingVertical: 11,
                  paddingHorizontal: 22,
                }}
              >
                <AppText variant="secondary" style={{ color: theme.palette.onSolid }}>
                  {t('detail.fixDone')}
                </AppText>
              </Pressable>
            </View>
          </View>
        )}
        <CardTopics
          topics={props.topics}
          typing={topicTyping}
          t={t}
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
      </View>
    </CardPage>
  );
}
