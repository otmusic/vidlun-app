import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Alert, ScrollView, View } from 'react-native';

import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { Locale, Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EntryChips } from '../components/EntryChips';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

export function EntryDetailScreen(props: {
  readonly entry: MoodEntry;
  readonly recordingUri: string | null;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onDelete: (id: string) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { entry, t } = props;

  const confirmDelete = (): void => {
    Alert.alert(t('delete.title'), t('delete.body'), [
      { text: t('delete.cancel'), style: 'cancel' },
      { text: t('delete.confirm'), style: 'destructive', onPress: () => props.onDelete(entry.id) },
    ]);
  };

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="caption" color="inkFaint">
          {formatWhen(entry.createdAt, props.locale)}
        </AppText>

        <Card tone="quiet">
          <AppText variant="quote">{`«${entry.cleanTranscript}»`}</AppText>
        </Card>

        {props.recordingUri !== null ? (
          <Playback uri={props.recordingUri} t={t} />
        ) : null}

        <EntryChips entry={entry} vocabulary={props.vocabulary} t={t} />

        {entry.observation !== null ? (
          <Card tone="accent">
            <AppText variant="narrative">{entry.observation}</AppText>
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ gap: theme.spacing.sm }}>
        <Button label={t('detail.back')} onPress={props.onBack} />
        <Button label={t('detail.delete')} variant="ghost" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

/**
 * Kept in its own component so the player is only created for an entry that
 * has audio — the hook cannot be called conditionally, and half a gigabyte of
 * model is enough for this screen to be carrying already.
 */
function Playback(props: { readonly uri: string; readonly t: Translate }): React.JSX.Element {
  const player = useAudioPlayer(props.uri);
  const status = useAudioPlayerStatus(player);

  const toggle = (): void => {
    if (status.playing) {
      player.pause();

      return;
    }

    // Rewind at the end, or a second tap does nothing and looks broken.
    if (status.didJustFinish || status.currentTime >= status.duration) {
      void player.seekTo(0);
    }

    player.play();
  };

  return (
    <Button
      label={props.t(status.playing ? 'detail.pause' : 'detail.play')}
      variant="ghost"
      onPress={toggle}
    />
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
