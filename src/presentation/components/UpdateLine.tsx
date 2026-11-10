import { Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from './AppText';
import { TapTarget } from './Button';
import { Icon, ICON_SIZE } from './Icon';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The line on top of home while the App Store sells a newer version
 * (owner's word, 2026-11-05). Quiet on purpose: it sits above the screen's
 * one job rather than competing with it, and wears the profile's row action,
 * an ink ring with the verb inside, rather than a filled button. An X puts it
 * away until a still newer version is out (2026-11-06).
 */
export function UpdateLine(props: {
  readonly t: Translate;
  readonly onUpdate: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('update.title')}. ${t('update.action')}`}
      onPress={props.onUpdate}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: theme.palette.line,
        backgroundColor: theme.palette.paper,
        borderRadius: theme.radii.card,
        paddingVertical: 12,
        paddingLeft: 18,
        // The X's own 44 points make the right edge; its margin pulls it in.
        paddingRight: 2,
        marginBottom: 20,
      }}
    >
      <AppText variant="secondary" color="inkSoft" style={{ flex: 1 }}>
        {t('update.title')}
      </AppText>
      <View
        style={{
          borderWidth: 1.5,
          borderColor: theme.palette.ink,
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 16,
        }}
      >
        <AppText variant="secondary" style={{ color: theme.palette.ink }}>
          {t('update.action')}
        </AppText>
      </View>
      <View style={{ marginLeft: -8, marginVertical: -12 }}>
        <TapTarget onPress={props.onClose} accessibilityLabel={t('common.close')}>
          <Icon name="x" size={ICON_SIZE.inline} color="inkFaint" />
        </TapTarget>
      </View>
    </Pressable>
  );
}
