import { View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { CheckShape } from '../components/Shapes';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

export function SavedScreen(props: {
  readonly t: Translate;
  readonly streakDays: number;
  readonly onHome: () => void;
}): React.JSX.Element {
  const theme = useTheme();

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
        <AppText variant="display">{props.t('saved.title')}</AppText>
        {props.streakDays > 0 ? (
          <Chip label={props.t('saved.streak', { count: props.streakDays })} tone="warm" />
        ) : null}
      </View>
      <Button label={props.t('saved.home')} onPress={props.onHome} />
    </Screen>
  );
}
