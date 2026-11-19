import { Alert, ScrollView, View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
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
import { WaveMark } from '../components/WaveMark';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, type Palette } from '../theme/tokens';
import { audioNoteKey } from './audioNote';
import { voiceLine } from './voiceLine';
import { emotionLabel, emotionTint, emotionWordsIn } from '../components/emotionDisplay';


/**
 * An entry as it stands, months later.
 *
 * The sentence leads and is set large: what someone comes back for is their
 * own words, not the analysis of them. Everything Vidlun added sits below it,
 * in that order — voice, mood, words, echo.
 */
export function EntryDetailScreen(props: {
  readonly entry: MoodEntry;
  readonly recordingUri: string | null;
  /** How the voice sounded against the usual one; null while it is being worked out. */
  readonly voice: VoiceHeard | null;
  /** The Profile switch as it stands now; it decides what a missing recording is blamed on. */
  readonly keepRecordings: boolean;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onDelete: (id: string) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const { entry, t } = props;
  const words = emotionWordsIn(entry.cleanTranscript, t);
  const tone = entry.mood === null ? null : toneFor(entry.mood.value);
  const heard = voiceLine(props.voice, t);

  const confirmDelete = (): void => {
    Alert.alert(t('delete.title'), t('delete.body'), [
      { text: t('delete.cancel'), style: 'cancel' },
      { text: t('delete.confirm'), style: 'destructive', onPress: () => props.onDelete(entry.id) },
    ]);
  };

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
        {/* A bin in red (owner's word, 2026-10-01); it still asks first. */}
        <TapTarget onPress={confirmDelete} accessibilityLabel={t('detail.delete')}>
          <Icon name="trash-2" size={ICON_SIZE.action} color="danger" />
        </TapTarget>
      </View>

      {/* Read, not re-read: a saved entry's words are no longer corrected here (owner's word, 2026-10-01). */}
      <AppText variant="display" style={{ fontSize: 23, lineHeight: 31, marginBottom: 14 }}>
        {t('common.quoted', { text: entry.cleanTranscript })}
      </AppText>

      {props.recordingUri === null ? (
        <AudioNote text={t(audioNoteKey(entry.source, props.keepRecordings))} />
      ) : (
        /*
         * Variant A (owner's word, 2026-11-19): the played part in the
         * entry's mood, and under the player one line on how the voice
         * sounded against its usual self — Vidlun speaking, so in the accent.
         */
        <Playback
          uri={props.recordingUri}
          t={t}
          tint={tone === null ? undefined : theme.palette[tone]}
          footer={
            heard === null ? undefined : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <WaveMark width={22} color={theme.palette.accentInk} />
                <AppText variant="secondary" color="accentInk" style={{ flexShrink: 1 }}>
                  {heard}
                </AppText>
              </View>
            )
          }
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
              <Chip key={tag} label={tag} tone="neutral" />
            ))}
          </View>
        </View>
      )}

      {entry.observation === null ? null : (
        <View
          style={{
            borderRadius: 26,
            backgroundColor: theme.palette.panel,
            padding: 24,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <WaveMark width={34} color={theme.palette.lime} />
            <AppText variant="caption" color="tileInk">
              {t('compare.echo')}
            </AppText>
          </View>
          <AppText variant="lede" color="onPanel">
            {entry.observation}
          </AppText>
        </View>
      )}

      {/*
        * Said once, quietly, on the screen people come back to rather than on
        * the one they are still writing. It is the difference between a journal
        * that describes and a product that seems to be advising.
        */}
    </ScrollView>
  );
}

/**
 * Where the player would have been, one quiet line on why there is none:
 * the entry was typed, recordings are off, or the voice is simply gone — a
 * year on, the voice goes and the entry stays. This is the only place a
 * person will ever ask the question, so it is answered here and nowhere else.
 */
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
