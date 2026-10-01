import { Alert, ScrollView, View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { type Locale, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { BackButton } from '../components/BackButton';
import { TapTarget } from '../components/Button';
import { Chip } from '../components/Chip';
import { Icon, ICON_SIZE } from '../components/Icon';
import { MoodLine } from '../components/MoodLine';
import { Playback } from '../components/Playback';
import { WaveMark } from '../components/WaveMark';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { audioNoteKey } from './audioNote';
import { emotionLabel, emotionTint } from '../components/emotionDisplay';


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
        <AppText variant="secondary" color="inkFaint">
          {formatWhen(entry.createdAt, props.locale)}
        </AppText>
        {/* A bin in red (owner's word, 2026-10-01); it still asks first. */}
        <TapTarget onPress={confirmDelete} accessibilityLabel={t('detail.delete')}>
          <Icon name="trash-2" size={ICON_SIZE.action} color="danger" />
        </TapTarget>
      </View>

      {/* Read, not re-read: a saved entry's words are no longer corrected here (owner's word, 2026-10-01). */}
      <AppText variant="display" style={{ fontSize: 23, lineHeight: 31, marginBottom: 14 }}>
        {`«${entry.cleanTranscript}»`}
      </AppText>

      {props.recordingUri === null ? (
        <AudioNote text={t(audioNoteKey(entry.source, props.keepRecordings))} />
      ) : (
        <Playback uri={props.recordingUri} t={t} />
      )}

      {entry.mood === null ? null : (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
          borderWidth: 1,
          borderColor: theme.palette.line,
          borderRadius: 26,
          backgroundColor: theme.palette.paper,
          paddingVertical: 20,
          paddingHorizontal: 22,
        }}
      >
        <MoodLine value={entry.mood.value} t={t} />
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {entry.emotionIds.map((id) => {
          return (
            <Chip
              key={id}
              label={emotionLabel(id, t)}
              color={
                emotionTint(id, props.vocabulary, theme)
              }
            />
          );
        })}
      </View>

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


function formatWhen(at: Date, locale: Locale): string {
  return at.toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
