import { Alert, Switch, View } from 'react-native';

import { LOCALES, type Translate, type TranslationKey } from '@/i18n';
import type { Settings, ThemeChoice } from '@/domain/ports/ISettings';

import { AppText } from '../components/AppText';
import { BackButton } from '../components/BackButton';
import { TapTarget } from '../components/Button';
import { Chip } from '../components/Chip';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

const THEME_LABELS: Record<ThemeChoice, TranslationKey> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

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
    <Screen inset={{ bottom: 118 }}>
      <BackButton t={t} onPress={props.onBack} />
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

      {/*
        No confirmation on this one, unlike the recordings switch: turning it
        off changes what the next card looks like and destroys nothing, so
        asking would be a step for its own sake.
      */}
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
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
            {t('settings.asksFirst')}
          </AppText>
          <Switch
            value={settings.asksFirst}
            onValueChange={(asksFirst) => {
              props.onChange({ ...settings, asksFirst });
            }}
            trackColor={{ true: theme.palette.accent, false: theme.palette.line }}
            accessibilityLabel={t('settings.asksFirst')}
          />
        </View>
        <AppText variant="secondary" color="inkFaint">
          {t('settings.asksFirstHint')}
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

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <AppText variant="label">{t('settings.theme')}</AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {THEME_CHOICES.map((choice) => (
            <TapTarget
              key={choice}
              onPress={() => props.onChange({ ...settings, theme: choice })}
              accessibilityLabel={t(THEME_LABELS[choice])}
            >
              <Chip
                label={t(THEME_LABELS[choice])}
                tone={settings.theme === choice ? 'calm' : 'neutral'}
              />
            </TapTarget>
          ))}
        </View>
        <AppText variant="secondary" color="inkFaint">
          {t('settings.themeHint')}
        </AppText>
      </View>

      <View style={{ flex: 1 }} />
    </Screen>
  );
}

/*
 * Language names live in the locale files with the same value in both, because
 * a language names itself: nobody scans a list for their own under a
 * translation of it. Same reason they are not hardcoded here — rule 1 keeps
 * every readable string in i18n, and this one is readable.
 */
