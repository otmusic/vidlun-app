import { View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { CheckShape } from '../components/Shapes';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/**
 * A take kept by an earlier version of the app, before the model came with
 * it, is read the moment this screen opens: the flow moves on to processing
 * by itself, so this is a beat rather than a wait. It keeps the drawing's
 * top-aligned column — a ring with a check, the title, the body — and the
 * way home, in case the person would rather not watch.
 */
export function ParkedScreen(props: {
  readonly t: Translate;
  readonly onHome: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;

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
        {t('parked.body')}
      </AppText>

      <View style={{ flex: 1, minHeight: 30 }} />

      <Button label={t('parked.home')} onPress={props.onHome} />
    </Screen>
  );
}
