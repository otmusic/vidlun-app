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
 * Shaped like the saved screen rather than the processing one on purpose:
 * nothing is being worked on, and a skeleton card would promise a result
 * that is minutes away. The download's own line says how far off. Leaving is
 * fine — the take waits on home.
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
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: theme.palette.calmSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckShape color={theme.palette.calm} size={36} />
        </View>
        <AppText variant="display" align="center">
          {props.t('parked.title')}
        </AppText>
        <AppText variant="body" color="inkSoft" align="center" style={{ maxWidth: 310 }}>
          {props.t('parked.body')}
        </AppText>
        <AppText variant="secondary" color="inkFaint" align="center">
          {percent === null
            ? props.t('home.voiceFetching')
            : `${props.t('home.voiceFetching')} · ${String(percent)}%`}
        </AppText>
      </View>
      <Button label={props.t('parked.home')} onPress={props.onHome} />
    </Screen>
  );
}
