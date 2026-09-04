import { View } from 'react-native';

import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { CheckShape } from '../components/Shapes';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/**
 * The take is kept; the phone cannot hear it yet.
 *
 * The drawing sets it as a top-aligned column rather than a centred moment:
 * a ring with a check, the title, the body, and below a rule the download's
 * own line with a hairline bar — the one thing on the screen still moving.
 * Leaving is fine; the take waits on home.
 *
 * Where nothing is moving — the download never started, or it failed — the
 * screen offers the download itself. The app does not start one on its own,
 * and a take parked behind a model nobody asked for would wait forever.
 */
export function ParkedScreen(props: {
  readonly t: Translate;
  readonly voice: SpeechModelState;
  readonly onFetchVoice: () => void;
  readonly onHome: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  // Ready is a moment on this screen: the flow moves on to reading the take.
  const moving = props.voice.kind === 'fetching' || props.voice.kind === 'ready';
  const percent =
    props.voice.kind === 'fetching' && props.voice.totalBytes !== null && props.voice.totalBytes > 0
      ? Math.min(99, Math.floor((props.voice.writtenBytes / props.voice.totalBytes) * 100))
      : null;

  return (
    <Screen inset={{ top: 78, sides: 22, bottom: 34 }} style={{ gap: 0 }}>
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          borderWidth: 1.5,
          borderColor: theme.palette.line,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 26,
        }}
      >
        <CheckShape color={theme.palette.accentInk} size={26} />
      </View>

      <AppText variant="display" style={{ marginBottom: 14 }}>
        {t('parked.title')}
      </AppText>
      <AppText variant="body" color="inkSoft" style={{ lineHeight: 24, marginBottom: 26 }}>
        {t(moving ? 'parked.body' : 'parked.bodyWaiting')}
      </AppText>

      {moving ? (
        <View
          style={{
            gap: 9,
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: theme.palette.line,
          }}
        >
          <AppText variant="caption" color="inkFaint" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {percent === null
              ? t('home.voiceFetching')
              : `${t('home.voiceFetching')} · ${String(percent)}%`}
          </AppText>
          <View
            style={{
              height: 2,
              borderRadius: 999,
              backgroundColor: theme.palette.line,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 2,
                width: `${percent ?? 0}%`,
                borderRadius: 999,
                backgroundColor: theme.palette.accent,
              }}
            />
          </View>
        </View>
      ) : props.voice.kind === 'failed' ? (
        <View style={{ paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.palette.line }}>
          <AppText variant="caption" color="inkFaint" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {t('home.voiceFailed')}
          </AppText>
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 30 }} />

      {moving ? (
        <Button label={t('parked.home')} onPress={props.onHome} />
      ) : (
        <View style={{ gap: 4 }}>
          <Button
            label={t(props.voice.kind === 'failed' ? 'failure.retry' : 'home.voiceDownload')}
            onPress={props.onFetchVoice}
          />
          <Button label={t('parked.home')} variant="ghost" onPress={props.onHome} />
        </View>
      )}
    </Screen>
  );
}
