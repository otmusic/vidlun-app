import { Pressable, View } from 'react-native';

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
  /** True after an entry that sounded overwhelmed; the card below appears. */
  readonly offersGrounding: boolean;
  readonly onGround: () => void;
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
      {props.offersGrounding ? (
        /*
         * Offered, never pushed: a card with a way in and a way past, worded
         * so declining costs nothing. The privacy line is on the card itself
         * because the person it is for has just said something hard out
         * loud, and "will this be kept?" is the first thing fear asks.
         */
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.palette.line,
            borderRadius: 22,
            padding: 22,
            gap: 14,
            marginBottom: 16,
          }}
        >
          <AppText variant="lede">{props.t('ground.offer')}</AppText>
          <AppText variant="secondary" color="inkFaint">
            {props.t('ground.offerFact')}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Pressable
              accessibilityRole="button"
              onPress={props.onGround}
              style={{
                borderWidth: 1,
                borderColor: theme.palette.lineStrong,
                borderRadius: 999,
                paddingVertical: 13,
                paddingHorizontal: 22,
              }}
            >
              <AppText variant="body">{props.t('ground.try')}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={props.onHome}
              hitSlop={8}
              style={{ paddingVertical: 13, paddingHorizontal: 16 }}
            >
              <AppText variant="body" color="inkFaint">
                {props.t('ground.notNow')}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Button label={props.t('saved.home')} onPress={props.onHome} />
    </Screen>
  );
}
