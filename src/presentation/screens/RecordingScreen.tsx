import { View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Orb } from '../components/Orb';
import { Screen } from './Screen';

export function RecordingScreen(props: {
  readonly t: Translate;
  readonly onStop: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  return (
    <Screen>
      <AppText variant="caption" color="inkFaint" align="center">
        {props.t('recording.listening')}
      </AppText>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Orb mode="recording" onPress={props.onStop} accessibilityLabel={props.t('recording.stop')} />
      </View>
      <AppText variant="secondary" color="inkFaint" align="center">
        {props.t('recording.hint')}
      </AppText>
      <Button label={props.t('common.cancel')} variant="ghost" onPress={props.onCancel} />
    </Screen>
  );
}
