import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import type { Locale, Translate, TranslationKey } from '@/i18n';
import { legalDocument, type LegalDocumentKind } from '@/i18n/legal';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Blob, WaveMark } from '../components/WaveMark';
import { useTheme } from '../theme/ThemeProvider';
import { LegalScreen } from './LegalScreen';
import { Screen } from './Screen';

type Step = 'welcome' | 'model' | 'privacy' | 'microphone';

/*
 * The download comes second, straight after the welcome. The tap on that
 * screen is the person's consent to 668 MB over whatever connection they are
 * on — nothing downloads before it — and going second gives the transfer the
 * two screens that follow to make headway before home. Where the system
 * delivered the model with the install there is nothing to ask, and the step
 * is not shown.
 */
const WITH_DOWNLOAD: readonly Step[] = ['welcome', 'model', 'privacy', 'microphone'];
const DELIVERED: readonly Step[] = ['welcome', 'privacy', 'microphone'];

const KICKER: Record<Step, TranslationKey> = {
  welcome: 'onboarding.step1Kicker',
  model: 'onboarding.step4Kicker',
  privacy: 'onboarding.step2Kicker',
  microphone: 'onboarding.step3Kicker',
};

const HEADLINE: Record<Step, TranslationKey> = {
  welcome: 'onboarding.welcomeTitle',
  model: 'onboarding.modelTitle',
  privacy: 'onboarding.privacyTitle',
  microphone: 'onboarding.micTitle',
};

const ACTION: Record<Step, TranslationKey> = {
  welcome: 'onboarding.welcomeAction',
  model: 'onboarding.modelAction',
  privacy: 'onboarding.privacyAction',
  microphone: 'onboarding.micAllow',
};

/**
 * The screens before the first entry, in the order §8 asks for: what this is,
 * the one download and the tap that starts it, what happens to your voice,
 * and only then the microphone. Being asked for a microphone by something
 * that has not said where the recording goes is the moment people decide an
 * app is not trustworthy.
 *
 * The frame never moves: rail, kicker, then the same two buttons in the same
 * place. Only the middle changes, so the screens read as one thing with an
 * end rather than separate demands.
 */
export function OnboardingScreen(props: {
  readonly t: Translate;
  readonly locale: Locale;
  readonly model: SpeechModelState;
  /** Starts the one-time download. Called from the tap that means it, never on its own. */
  readonly onFetchModel: () => void;
  readonly onAskMicrophone: () => Promise<PermissionStatus>;
  readonly onDone: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  /*
   * Decided once, at the start: the model may land while these screens are
   * up, and a rail that lost a mark halfway through would move the person
   * backwards.
   */
  const [steps] = useState<readonly Step[]>(() =>
    props.model.kind === 'ready' ? DELIVERED : WITH_DOWNLOAD,
  );
  /*
   * The terms or the privacy policy, opened from the first screen's footer.
   * Held here rather than in the flow: onboarding runs before the capture
   * flow exists, and what someone reads before agreeing stays their business.
   */
  const [reading, setReading] = useState<LegalDocumentKind | null>(null);
  const { t } = props;
  const step = steps[index] ?? 'welcome';
  const isLast = index === steps.length - 1;

  if (reading !== null) {
    return (
      <LegalScreen
        document={legalDocument(reading, props.locale)}
        t={t}
        onBack={() => {
          setReading(null);
        }}
      />
    );
  }

  const advance = (): void => {
    if (step === 'model') {
      // The tap is the consent. The transfer runs on under the screens that
      // follow, and home carries its progress from there.
      props.onFetchModel();
      setIndex(index + 1);

      return;
    }

    if (step === 'microphone') {
      // The answer does not gate anything: someone who says no still has a
      // working journal, and asking twice would be worse than either outcome.
      void props.onAskMicrophone().finally(() => {
        props.onDone();
      });

      return;
    }

    if (!isLast) {
      setIndex(index + 1);

      return;
    }

    props.onDone();
  };

  return (
    <Screen inset={{ top: 74, sides: 28, bottom: 40 }} style={{ gap: 0 }}>
      <ProgressRail reached={index} of={steps.length} />

      <AppText variant="kicker" style={{ marginTop: 24 }}>
        {t(KICKER[step])}
      </AppText>

      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          gap: step === 'welcome' ? 34 : 26,
        }}
      >
        {step === 'welcome' ? (
          <WaveMark width={214} color={theme.palette.ink} echoColor={theme.palette.accent} />
        ) : null}
        <Headline>{t(HEADLINE[step])}</Headline>
        {step === 'welcome' ? <Lede>{t('onboarding.welcomeBody')}</Lede> : null}
        {step === 'model' ? (
          <>
            <View style={{ gap: 16, maxWidth: 320 }}>
              <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
                {t('onboarding.modelBody1')}
              </AppText>
              <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
                {t('onboarding.modelBody2')}
              </AppText>
              <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
                {t('onboarding.modelBody3')}
              </AppText>
            </View>
            <SizeCard t={t} />
          </>
        ) : null}
        {step === 'privacy' ? (
          <View style={{ gap: 18, maxWidth: 320 }}>
            <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
              {t('onboarding.privacyOnDevice')}
            </AppText>
            <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
              {t('onboarding.privacyKeep')}
            </AppText>
            <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
              {t('onboarding.privacyDelete')}
            </AppText>
          </View>
        ) : null}
        {step === 'microphone' ? <Lede>{t('onboarding.micBody')}</Lede> : null}
      </View>

      <View style={{ gap: 4 }}>
        <Button label={t(ACTION[step])} onPress={advance} />
        {step === 'model' ? (
          /* Consent has to be refusable. Later means the next screen, not the
             end: the microphone still has to be asked for, and home offers
             the download again in its own line. */
          <Button
            label={t('onboarding.modelLater')}
            variant="ghost"
            onPress={() => {
              setIndex(index + 1);
            }}
          />
        ) : (
          <Button
            label={t(step === 'microphone' ? 'onboarding.micLater' : 'onboarding.skip')}
            variant="ghost"
            onPress={props.onDone}
          />
        )}
      </View>
      {step === 'welcome' ? (
        /* The drawing puts the agreement under the first screen only: the tap
           it names is this screen's button, and repeating it three times would
           turn a footnote into a form. */
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 8, paddingHorizontal: 6 }}>
          <AppText variant="caption" color="inkFaint" align="center" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {t('onboarding.legalNote')}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <FooterLink
              label={t('onboarding.legalTerms')}
              onPress={() => {
                setReading('terms');
              }}
            />
            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 999,
                backgroundColor: theme.palette.line,
              }}
            />
            <FooterLink
              label={t('onboarding.legalPrivacy')}
              onPress={() => {
                setReading('privacy');
              }}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/** A quiet underlined link, as the drawing sets the footer's pair. */
function FooterLink(props: {
  readonly label: string;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable accessibilityRole="link" onPress={props.onPress} hitSlop={10}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: theme.palette.line, paddingBottom: 1 }}>
        <AppText variant="caption" color="inkSoft" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {props.label}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * Marks rather than "1 of 4". The rail says how much is left without asking
 * anyone to read a number before they have been told anything.
 */
function ProgressRail(props: { readonly reached: number; readonly of: number }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: props.of }, (_unused, at) => (
        <View
          key={at}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: at <= props.reached ? theme.palette.ink : theme.palette.line,
          }}
        />
      ))}
    </View>
  );
}

/**
 * A lime shape sits behind the first words, off to the left, the way a
 * highlighter runs past the edge of what it marks. It is decoration and is
 * hidden from screen readers; the headline itself carries the meaning.
 */
function Headline(props: { readonly children: React.ReactNode }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View
        pointerEvents="none"
        importantForAccessibility="no"
        style={{ position: 'absolute', left: -12, top: -19 }}
      >
        <Blob width={88} fill={theme.palette.lime} line={theme.palette.ink} />
      </View>
      <AppText variant="hero">{props.children}</AppText>
    </View>
  );
}

function Lede(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <AppText variant="lede" color="inkSoft" style={{ maxWidth: 310 }}>
      {props.children}
    </AppText>
  );
}

/**
 * The drawing's tinted card on the download screen, carrying the number
 * rather than a bar: nothing is moving yet, and a bar at nought would say
 * something had started.
 */
function SizeCard(props: { readonly t: Translate }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={{
        gap: 6,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: theme.palette.limeSoft,
      }}
    >
      <AppText variant="caption" color="ink" style={{ textTransform: 'none', letterSpacing: 0 }}>
        {props.t('onboarding.modelSize')}
      </AppText>
      <AppText variant="secondary" color="inkSoft" style={{ fontSize: 13.5, lineHeight: 19 }}>
        {props.t('onboarding.modelWifi')}
      </AppText>
    </View>
  );
}
