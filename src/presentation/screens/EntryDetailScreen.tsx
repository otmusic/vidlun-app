import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Circle, Svg } from 'react-native-svg';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import { emotionKey, type Locale, type Translate, type TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { FixWording } from '../components/FixWording';
import { BackButton } from '../components/BackButton';
import { Chip } from '../components/Chip';
import { moodTone } from '../components/emotionTone';
import { Playback } from '../components/Playback';
import { WaveMark } from '../components/WaveMark';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

const MOOD_LABELS: readonly TranslationKey[] = ['mood.1', 'mood.2', 'mood.3', 'mood.4', 'mood.5'];
const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

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
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onDelete: (id: string) => void;
  readonly onBack: () => void;
  /** The sentence, fixed by the one person who knows what was said; it is re-read. */
  readonly onFix: (entry: MoodEntry, text: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { entry, t } = props;
  const scheme = theme.isDark ? 'dark' : 'light';

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
        paddingTop: 70,
        paddingHorizontal: 22,
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
        <Pressable accessibilityRole="button" onPress={confirmDelete} hitSlop={12}>
          <AppText variant="secondary" color="inkFaint">
            {t('detail.delete')}
          </AppText>
        </Pressable>
      </View>

      <FixWording
        text={entry.cleanTranscript}
        t={t}
        onFix={(text) => {
          props.onFix(entry, text);
        }}
        style={{ gap: 12, marginBottom: 14 }}
      >
        <AppText variant="display" style={{ fontSize: 23, lineHeight: 31 }}>
          {`«${entry.cleanTranscript}»`}
        </AppText>
      </FixWording>

      {props.recordingUri === null ? <AudioGone t={t} /> : <Playback uri={props.recordingUri} t={t} />}

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
        <MoodRing value={entry.mood.value} />
        <View style={{ gap: 5 }}>
          <AppText variant="caption" color="inkFaint">
            {t('compare.mood')}
          </AppText>
          <AppText variant="display" style={{ fontSize: 20 }} color={moodTone(entry.mood.value)}>
            {`${entry.mood.value} ${t('detail.ofFive')}`}
          </AppText>
          <AppText variant="secondary" color="inkSoft">
            {t(MOOD_LABELS[entry.mood.value - 1] ?? 'mood.3')}
          </AppText>
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {entry.emotionIds.map((id) => {
          const emotion = props.vocabulary.find(id);

          return (
            <Chip
              key={id}
              label={t(emotionKey(id))}
              color={
                emotion === undefined ? undefined : colorForEmotion(props.vocabulary, emotion, scheme)
              }
            />
          );
        })}
        {entry.contextTags.map((tag) => (
          <Chip key={tag} label={tag} tone="neutral" />
        ))}
      </View>

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
      <AppText variant="secondary" color="inkFaint" style={{ fontSize: 12, marginTop: 4 }}>
        {t('detail.disclaimer')}
      </AppText>

    </ScrollView>
  );
}

/**
 * A year on, the voice goes and the entry stays. Saying so where the player
 * would have been is the only place a person will ever ask the question.
 */
function AudioGone(props: { readonly t: Translate }): React.JSX.Element {
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
        {props.t('detail.audioGone')}
      </AppText>
    </View>
  );
}

function MoodRing(props: { readonly value: number }): React.JSX.Element {
  const theme = useTheme();

  return (
    <Svg width={66} height={66} viewBox="0 0 72 72">
      <Circle cx={36} cy={36} r={RING_RADIUS} fill="none" stroke={theme.palette.line} strokeWidth={7} />
      <Circle
        cx={36}
        cy={36}
        r={RING_RADIUS}
        fill="none"
        stroke={theme.palette[moodTone(props.value)]}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${(props.value / 5) * RING_LENGTH} ${RING_LENGTH}`}
        transform="rotate(-90 36 36)"
      />
    </Svg>
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
