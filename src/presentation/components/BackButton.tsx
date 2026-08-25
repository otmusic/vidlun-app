import { View } from 'react-native';

import type { Translate } from '@/i18n';

import { Icon, ICON_SIZE } from './Icon';
import { TapTarget } from './Button';

/**
 * Top left, where the eye looks for a way out of a screen it did not start on.
 *
 * §7.3 keeps the *primary* action in the thumb zone, and back is not one — the
 * screens carrying this have no primary action at all. The cost is reach: on a
 * large phone the top left corner is the furthest point from a thumb, and
 * there is no edge-swipe to fall back on yet.
 */
export function BackButton(props: {
  readonly t: Translate;
  readonly onPress: () => void;
}): React.JSX.Element {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <TapTarget onPress={props.onPress} accessibilityLabel={props.t('common.back')}>
        <Icon name="arrow-left" size={ICON_SIZE.action} color="ink" />
      </TapTarget>
    </View>
  );
}
