import { Alert, View } from 'react-native';

import type { Locale, Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { TapTarget } from './Button';
import { Icon, ICON_SIZE } from './Icon';

/** How many steps the card has (owner's word, 2026-11-23): the words, the feelings, the mood. */
export const CARD_STEPS = 3;

/**
 * The top of every step of the card: the way back from the second step on,
 * when the entry was made, and the red bin that throws the unsaved entry
 * away after asking, as a saved entry's page does (owner's word,
 * 2026-11-19). Under them, one bar per step, filled up to this one.
 */
export function CardHeader(props: {
  /** One-based. */
  readonly step: number;
  readonly createdAt: Date;
  readonly locale: Locale;
  readonly t: Translate;
  /** Absent on the first step: there is nowhere back to but the take, which is gone. */
  readonly onBack?: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  const time = props.createdAt.toLocaleTimeString(props.locale, { hour: '2-digit', minute: '2-digit' });

  const confirmDiscard = (): void => {
    Alert.alert(t('delete.title'), t('delete.body'), [
      { text: t('delete.cancel'), style: 'cancel' },
      { text: t('delete.confirm'), style: 'destructive', onPress: props.onDiscard },
    ]);
  };

  return (
    <View style={{ gap: 10, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <View style={{ width: 44, alignItems: 'flex-start' }}>
          {props.onBack === undefined ? null : (
            <TapTarget onPress={props.onBack} accessibilityLabel={t('common.back')}>
              <Icon name="arrow-left" size={ICON_SIZE.action} color="ink" />
            </TapTarget>
          )}
        </View>
        <AppText variant="caption" color="inkFaint">
          {t('card.newEntry', { time })}
        </AppText>
        <View style={{ width: 44, alignItems: 'flex-end' }}>
          <TapTarget onPress={confirmDiscard} accessibilityLabel={t('detail.delete')}>
            <Icon name="trash-2" size={ICON_SIZE.action} color="danger" />
          </TapTarget>
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('card.step', { n: props.step, total: CARD_STEPS })}
        style={{ flexDirection: 'row', gap: 6 }}
      >
        {Array.from({ length: CARD_STEPS }, (_, at) => (
          <View
            key={at}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: at < props.step ? theme.palette.ink : theme.palette.line,
            }}
          />
        ))}
      </View>
    </View>
  );
}
