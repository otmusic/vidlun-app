import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { shareAt } from '@/application/use-cases/FindSpokenMoment';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { SpeechSpan } from '@/domain/ports/ISpeechTimeline';
import { SearchQuery, type TextMatch } from '@/domain/value-objects/SearchQuery';
import type { VoiceHeard } from '@/domain/value-objects/VoiceCue';
import { type Locale, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { BackButton } from '../components/BackButton';
import { TapTarget } from '../components/Button';
import { Chip } from '../components/Chip';
import { Icon, ICON_SIZE } from '../components/Icon';
import { moodKey } from '../components/MoodLine';
import { toneFor } from '../components/emotionTone';
import { Playback } from '../components/Playback';
import { VoicePortrait } from '../components/VoicePortrait';
import { WaveMark } from '../components/WaveMark';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, type Palette } from '../theme/tokens';
import { audioNoteKey } from './audioNote';
import { piecesOf } from './journalSearch';
import { transcriptPieces, wordAt } from './spokenWord';
import { voiceLine } from './voiceLine';
import { emotionLabel, emotionTint, emotionWordsIn } from '../components/emotionDisplay';


/**
 * An entry as it stands, months later.
 *
 * With a voice, the voice leads (owner's word, 2026-11-24, variant B): one
 * card holds the player, the line on how the voice sounded — its scales
 * folding out under it, closed to begin with — and the transcript, open to
 * begin with. Every entry opens that way. As it plays, the word being said
 * is lit in the mood's colour, give or take, as the played bars are.
 *
 * Without a voice, the sentence leads and is set large, with a note under it
 * saying why there is nothing to play. Everything Vidlun added sits below,
 * in that order — mood, words, topics.
 */
export function EntryDetailScreen(props: {
  readonly entry: MoodEntry;
  readonly recordingUri: string | null;
  /** How the voice sounded against the usual one; null while it is being worked out. */
  readonly voice: VoiceHeard | null;
  /**
   * The search the entry was opened from (owner's word, 2026-11-20): its
   * words are lit in the sentence. Null when it was opened any other way.
   */
  readonly found: string | null;
  /** Where in the recording the searched word is said, give or take; null when unknown. */
  readonly playFromMs: number | null;
  /** False while the recording is looked up: neither layout is drawn until it is known. */
  readonly recordingKnown: boolean;
  /** Where the speech is in the recording, to light the word being said; null when unknown. */
  readonly speech: readonly SpeechSpan[] | null;
  /** The Profile switch as it stands now; it decides what a missing recording is blamed on. */
  readonly keepRecordings: boolean;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onDelete: (id: string) => void;
  /** A topic tapped: the journal, narrowed to it (owner's word, 2026-11-24). */
  readonly onOpenTopic: (topic: string) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const { entry, t } = props;
  const words = emotionWordsIn(entry.cleanTranscript, t);
  const tone = entry.mood === null ? null : toneFor(entry.mood.value);
  const heard = voiceLine(props.voice, t);
  // The scales behind the line, when there is something to set them against.
  const portrait = props.voice?.kind === 'compared' && props.voice.portrait.length > 0 ? props.voice.portrait : null;
  const [portraitOpen, setPortraitOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const marks = props.found === null ? [] : (SearchQuery.of(props.found)?.matchesIn(entry.cleanTranscript) ?? []);
  const firstFound = marks[0];
  // The sentence sits inside the language's own quotation marks, which the lit words must not break.
  const [quoteOpen, quoteClose] = t('common.quoted', { text: QUOTE_SLOT }).split(QUOTE_SLOT);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{
        paddingTop: top,
        ...sides,
        paddingBottom: 40,
        gap: 14,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <BackButton t={t} onPress={props.onBack} />
        {/* Heavier and in ink, so the day is what the eye finds first (owner's word, 2026-10-12). */}
        <AppText variant="secondary" color="ink" style={{ fontFamily: fonts.strong }}>
          {formatWhen(entry.createdAt, props.locale)}
        </AppText>
        {/*
          A bin in red (owner's word, 2026-10-01). It no longer asks first
          (owner's word, 2026-11-19): the undo line offers the entry back for
          five seconds instead.
        */}
        <TapTarget onPress={() => props.onDelete(entry.id)} accessibilityLabel={t('detail.delete')}>
          <Icon name="trash-2" size={ICON_SIZE.action} color="danger" />
        </TapTarget>
      </View>

      {!props.recordingKnown ? null : props.recordingUri === null ? (
        <>
          {/* Read, not re-read: a saved entry's words are no longer corrected here (owner's word, 2026-10-01). */}
          <AppText variant="display" style={{ fontSize: 23, lineHeight: 31, marginBottom: 14 }}>
            {marks.length === 0
              ? t('common.quoted', { text: entry.cleanTranscript })
              : [
                  quoteOpen,
                  ...piecesOf(entry.cleanTranscript, marks).map((piece, at) =>
                    piece.found ? (
                      <Text key={at} style={{ backgroundColor: theme.palette.accentSoft }}>
                        {piece.text}
                      </Text>
                    ) : (
                      piece.text
                    ),
                  ),
                  quoteClose,
                ]}
          </AppText>
          <AudioNote text={t(audioNoteKey(entry.source, props.keepRecordings))} />
        </>
      ) : (
        <Playback
          uri={props.recordingUri}
          t={t}
          tint={tone === null ? undefined : theme.palette[tone]}
          startAtMs={props.playFromMs}
          caption={
            props.playFromMs === null || firstFound === undefined
              ? undefined
              : t('search.playsFrom', {
                  word: entry.cleanTranscript.slice(firstFound.start, firstFound.end),
                })
          }
          footer={(place) => (
            <View style={{ gap: 12 }}>
              {heard === null ? null : (
                <View style={{ gap: 14 }}>
                  {/*
                    * The line on how the voice sounded (variant A, owner's word,
                    * 2026-11-19); a tap folds the scales out under it rather
                    * than opening a sheet (2026-11-24). Without scales to show
                    * — too few takes yet — it is a line and nothing more.
                    */}
                  <Pressable
                    disabled={portrait === null}
                    accessibilityRole={portrait === null ? 'text' : 'button'}
                    accessibilityHint={portrait === null ? undefined : t('voice.open')}
                    accessibilityState={portrait === null ? undefined : { expanded: portraitOpen }}
                    onPress={() => setPortraitOpen((open) => !open)}
                    hitSlop={8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <WaveMark width={22} color={theme.palette.accentInk} />
                    <AppText variant="secondary" color="accentInk" style={{ flexShrink: 1 }}>
                      {heard}
                    </AppText>
                    {portrait === null ? null : (
                      <View style={{ marginLeft: 'auto' }}>
                        <Icon name={portraitOpen ? 'chevron-up' : 'chevron-down'} size={16} color="accentInk" />
                      </View>
                    )}
                  </Pressable>
                  {portrait === null || !portraitOpen ? null : <VoicePortrait portrait={portrait} t={t} />}
                </View>
              )}

              <View
                style={
                  heard === null
                    ? { gap: 12 }
                    : { gap: 12, borderTopWidth: 1, borderTopColor: theme.palette.line, paddingTop: 12 }
                }
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: transcriptOpen }}
                  onPress={() => setTranscriptOpen((open) => !open)}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <Icon name="align-left" size={18} color="ink" />
                  <AppText variant="label" style={{ fontSize: 14 }}>
                    {t('entry.transcript')}
                  </AppText>
                  <View style={{ marginLeft: 'auto' }}>
                    <Icon name={transcriptOpen ? 'chevron-up' : 'chevron-down'} size={16} color="ink" />
                  </View>
                </Pressable>
                {!transcriptOpen ? null : (
                  <Transcript
                    text={entry.cleanTranscript}
                    found={marks}
                    spoken={
                      place.under && props.speech !== null
                        ? wordAt(entry.cleanTranscript, shareAt(place.atMs, props.speech))
                        : null
                    }
                    spokenColor={tone === null ? theme.palette.accentSoft : theme.palette[`${tone}Soft` as keyof Palette]}
                  />
                )}
              </View>
            </View>
          )}
        />
      )}

      {/*
        * Each under its own name, so the person knows what they are looking
        * at (owner's word, 2026-11-19: the captions came back after variant A
        * dropped them). The mood keeps A's chip, in its own colour.
        */}
      {entry.mood === null || tone === null ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <AppText variant="caption" color="inkFaint">
            {t('compare.mood')}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              borderRadius: 999,
              paddingVertical: 7,
              paddingHorizontal: 14,
              backgroundColor: theme.palette[`${tone}Soft` as keyof Palette],
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.palette[tone] }} />
            <AppText variant="secondary" color={`${tone}Ink` as keyof Palette}>
              {t(moodKey(entry.mood.value))}
            </AppText>
          </View>
        </View>
      )}

      {entry.emotionIds.length === 0 ? null : (
        <View style={{ gap: 10 }}>
          <AppText variant="caption" color="inkFaint">
            {t('entry.emotions')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {entry.emotionIds.map((id) => (
              <Chip key={id} label={emotionLabel(id, words)} color={emotionTint(id, props.vocabulary, theme)} />
            ))}
          </View>
        </View>
      )}

      {entry.emotionIds.length > 0 ? null : (
        /*
         * The same finding the card showed, kept when the entry is opened
         * again: §6 calls an empty proposal correct and common, and a card
         * that simply has no chips reads as one that lost them.
         */
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.palette.line,
            borderRadius: 22,
            padding: 20,
            gap: 6,
          }}
        >
          <AppText variant="caption" color="accentInk">
            {t('compare.lunaNone')}
          </AppText>
          <AppText variant="body">{t('compare.noneCopy')}</AppText>
        </View>
      )}

      {entry.contextTags.length === 0 ? null : (
        <View style={{ gap: 10 }}>
          <AppText variant="caption" color="inkFaint">
            {t('entry.topics')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {entry.contextTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                tone="neutral"
                onPress={() => {
                  props.onOpenTopic(tag);
                }}
              />
            ))}
          </View>
        </View>
      )}

      {/*
        * No echo card (owner's word, 2026-11-19): the line under the player
        * and the voice portrait already say how the entry sounded. An echo
        * saved before stays in the entry and in the export, unshown.
        */}

      {/*
        * Said once, quietly, on the screen people come back to rather than on
        * the one they are still writing. It is the difference between a journal
        * that describes and a product that seems to be advising.
        */}

    </ScrollView>
  );
}

/** A stand-in for the sentence, so the quotation marks can be split from around it. */
const QUOTE_SLOT = '\u0000';

/**
 * Where the player would have been, one quiet line on why there is none:
 * the entry was typed, recordings are off, or the voice is simply gone — a
 * year on, the voice goes and the entry stays. This is the only place a
 * person will ever ask the question, so it is answered here and nowhere else.
 */
/**
 * The transcript in the card, at the size people re-read their own words at
 * (§7.2: 16), with a searched word lit in the accent and the word being said
 * lit in the mood's colour as it plays.
 */
function Transcript(props: {
  readonly text: string;
  readonly found: readonly TextMatch[];
  readonly spoken: TextMatch | null;
  readonly spokenColor: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <AppText variant="quote">
      {transcriptPieces(props.text, props.found, props.spoken).map((piece, at) =>
        piece.found || piece.spoken ? (
          <Text
            key={at}
            style={{ backgroundColor: piece.spoken ? props.spokenColor : theme.palette.accentSoft }}
          >
            {piece.text}
          </Text>
        ) : (
          piece.text
        ),
      )}
    </AppText>
  );
}

function AudioNote(props: { readonly text: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.palette.line,
        borderRadius: 26,
        paddingVertical: 15,
        paddingHorizontal: 18,
      }}
    >
      {/* A microphone struck through beside the note (owner's word, 2026-11-24). */}
      <Icon name="mic-off" size={16} color="inkFaint" />
      <AppText variant="secondary" color="inkFaint" style={{ flex: 1, fontSize: 13 }}>
        {props.text}
      </AppText>
    </View>
  );
}

/**
 * US English since 2026-10-30, like the journal's own dates ("October 30 ·
 * 12:37 PM"): en-GB put the day first and the clock in 24 hours, the one
 * British date in an American app.
 */
function formatWhen(at: Date, locale: Locale): string {
  return locale === 'uk'
    ? at.toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : at.toLocaleString('en-US', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
}
