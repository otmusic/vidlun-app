import { useState } from 'react';
import { View } from 'react-native';

import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

type Step = 'welcome' | 'privacy' | 'microphone';

/**
 * Three screens before the first entry, in the order §8 asks for: what this is,
 * what happens to your voice, and only then the microphone. Being asked for a
 * microphone by something that has not said where the recording goes is the
 * moment people decide an app is not trustworthy.
 */
export function OnboardingScreen(props: {
  readonly t: Translate;
  readonly model: SpeechModelState;
  readonly onAskMicrophone: () => Promise<PermissionStatus>;
  readonly onDone: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  const { t } = props;

  if (step === 'welcome') {
    return (
      <Screen centered>
        <AppText variant="display" align="center">
          {t('onboarding.welcomeTitle')}
        </AppText>
        <AppText variant="body" align="center" color="inkSoft">
          {t('onboarding.welcomeBody')}
        </AppText>
        <View style={{ height: theme.spacing.lg }} />
        <Button label={t('onboarding.welcomeAction')} onPress={() => setStep('privacy')} />
      </Screen>
    );
  }

  if (step === 'privacy') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
          <AppText variant="display">{t('onboarding.privacyTitle')}</AppText>
          <AppText variant="body" color="inkSoft">
            {t('onboarding.privacyOnDevice')}
          </AppText>
          <AppText variant="body" color="inkSoft">
            {t('onboarding.privacyKeep')}
          </AppText>
          <AppText variant="body" color="inkSoft">
            {t('onboarding.privacyDelete')}
          </AppText>
        </View>
        <Button label={t('onboarding.privacyAction')} onPress={() => setStep('microphone')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
        <AppText variant="display">{t('onboarding.micTitle')}</AppText>
        <AppText variant="body" color="inkSoft">
          {t('onboarding.micBody')}
        </AppText>
        <ModelProgress state={props.model} t={t} />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t('onboarding.micAllow')}
          onPress={() => {
            // The answer does not gate anything: someone who says no still has
            // a working journal, and asking twice would be worse than either.
            void props.onAskMicrophone().finally(props.onDone);
          }}
        />
        <Button label={t('onboarding.micLater')} variant="ghost" onPress={props.onDone} />
      </View>
    </Screen>
  );
}

/**
 * Progress, never a gate. Half a gigabyte over a phone connection is the wrong
 * thing to make someone wait for before their first entry, and the text path
 * needs none of it.
 */
function ModelProgress(props: {
  readonly state: SpeechModelState;
  readonly t: Translate;
}): React.JSX.Element | null {
  if (props.state.kind === 'ready') {
    return (
      <AppText variant="secondary" color="inkFaint">
        {props.t('onboarding.downloadReady')}
      </AppText>
    );
  }

  if (props.state.kind !== 'fetching') {
    return null;
  }

  const done = Math.round(props.state.writtenBytes / 1_000_000);
  const total = props.state.totalBytes === null ? '?' : Math.round(props.state.totalBytes / 1_000_000);

  return (
    <View>
      <AppText variant="secondary" color="inkFaint">
        {props.t('onboarding.downloading', { done, total })}
      </AppText>
      <AppText variant="secondary" color="inkFaint">
        {props.t('onboarding.downloadLater')}
      </AppText>
    </View>
  );
}
