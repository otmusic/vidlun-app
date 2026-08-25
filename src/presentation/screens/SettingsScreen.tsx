import { Alert, Switch, View } from 'react-native';

import { LOCALES, type Translate } from '@/i18n';
import type { Settings } from '@/domain/ports/ISettings';

import { AppText } from '../components/AppText';
import { Button, TapTarget } from '../components/Button';
import { Chip } from '../components/Chip';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

export function SettingsScreen(props: {
  readonly settings: Settings;
  readonly t: Translate;
  readonly onChange: (settings: Settings) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { settings, t } = props;

  const toggleRecordings = (keep: boolean): void => {
    if (keep) {
      props.onChange({ ...settings, keepRecordings: true });

      return;
    }

    /*
     * Turning this off means the voice goes, not merely that no more is kept.
     * Someone switching it off wants what is already there gone, and leaving a
     * year of audio behind a switch that says no would be the opposite of what
     * they asked for. Said out loud rather than done quietly.
     */
    Alert.alert(t('settings.forgetTitle'), t('settings.forgetBody'), [
      { text: t('settings.forgetCancel'), style: 'cancel' },
      {
        text: t('settings.forgetConfirm'),
        style: 'destructive',
        onPress: () => props.onChange({ ...settings, keepRecordings: false }),
      },
    ]);
  };

  return (
    <Screen>
      <AppText variant="display">{t('settings.title')}</AppText>

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
            minHeight: 52,
          }}
        >
          <AppText variant="label" style={{ flex: 1 }}>
            {t('settings.keepRecordings')}
          </AppText>
          <Switch
            value={settings.keepRecordings}
            onValueChange={toggleRecordings}
            trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
            accessibilityLabel={t('settings.keepRecordings')}
          />
        </View>
        <AppText variant="secondary" color="inkFaint">
          {t('settings.keepRecordingsHint')}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <AppText variant="label">{t('settings.language')}</AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {LOCALES.map((locale) => (
            <TapTarget
              key={locale}
              onPress={() => props.onChange({ ...settings, locale })}
              accessibilityLabel={t(`language.${locale}`)}
            >
              <Chip
                label={t(`language.${locale}`)}
                tone={settings.locale === locale ? 'calm' : 'neutral'}
              />
            </TapTarget>
          ))}
        </View>
      </View>

      <View style={{ flex: 1 }} />
      <Button label={t('settings.back')} onPress={props.onBack} />
    </Screen>
  );
}

/*
 * Language names live in the locale files with the same value in both, because
 * a language names itself: nobody scans a list for their own under a
 * translation of it. Same reason they are not hardcoded here — rule 1 keeps
 * every readable string in i18n, and this one is readable.
 */
