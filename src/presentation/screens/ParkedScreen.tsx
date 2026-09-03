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
 */
export function ParkedScreen(props: {
  readonly t: Translate;
  readonly voice: SpeechModelState;
  readonly onHome: () => void;
}): React.JSX.Element {
  const theme = useTheme();
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
        {props.t('parked.title')}
      </AppText>
      <AppText variant="body" color="inkSoft" style={{ lineHeight: 24, marginBottom: 26 }}>
        {props.t('parked.body')}
      </AppText>

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
            ? props.t('home.voiceFetching')
            : `${props.t('home.voiceFetching')} · ${String(percent)}%`}
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

      <View style={{ flex: 1, minHeight: 30 }} />

      <Button label={props.t('parked.home')} onPress={props.onHome} />
    </Screen>
  );
}
