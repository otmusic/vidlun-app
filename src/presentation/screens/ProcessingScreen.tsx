import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Orb } from '../components/Orb';
import { Screen } from './Screen';

export function ProcessingScreen(props: { readonly t: Translate }): React.JSX.Element {
  return (
    <Screen centered>
      <Orb mode="thinking" accessibilityLabel={props.t('processing.thinking')} />
      <AppText variant="display" align="center">
        {props.t('processing.thinking')}
      </AppText>
    </Screen>
  );
}
