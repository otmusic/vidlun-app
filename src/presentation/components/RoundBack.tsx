import { Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The way out of a screen you arrived at by choice. Round, outlined and on its
 * own row, unlike the text back link the capture flow uses: these screens are
 * somewhere you went rather than a step you are in the middle of.
 */
export function RoundBack(props: {
  readonly t: Translate;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.t('common.back')}
        onPress={props.onPress}
        hitSlop={8}
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.palette.line,
          backgroundColor: theme.palette.paper,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="body">←</AppText>
      </Pressable>
    </View>
  );
}
