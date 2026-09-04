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

const STEPS = ['welcome', 'privacy', 'microphone', 'model'] as const;

type Step = (typeof STEPS)[number];

const KICKER: Record<Step, TranslationKey> = {
  welcome: 'onboarding.step1Kicker',
  privacy: 'onboarding.step2Kicker',
  microphone: 'onboarding.step3Kicker',
  model: 'onboarding.step4Kicker',
};

const HEADLINE: Record<Step, TranslationKey> = {
  welcome: 'onboarding.welcomeTitle',
  privacy: 'onboarding.privacyTitle',
  microphone: 'onboarding.micTitle',
  model: 'onboarding.modelTitle',
};

const ACTION: Record<Step, TranslationKey> = {
  welcome: 'onboarding.welcomeAction',
  privacy: 'onboarding.privacyAction',
  microphone: 'onboarding.micAllow',
  model: 'onboarding.modelAction',
};

/**
 * Three screens before the first entry, in the order §8 asks for: what this is,
 * what happens to your voice, and only then the microphone. Being asked for a
 * microphone by something that has not said where the recording goes is the
 * moment people decide an app is not trustworthy.
 *
 * The frame never moves: rail, kicker, then the same two buttons in the same
 * place. Only the middle changes, so the three screens read as one thing with
 * an end rather than three separate demands.
 */
export function OnboardingScreen(props: {
  readonly t: Translate;
  readonly locale: Locale;
  readonly model: SpeechModelState;
  readonly onAskMicrophone: () => Promise<PermissionStatus>;
  readonly onDone: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  /*
   * The terms or the privacy policy, opened from the first screen's footer.
   * Held here rather than in the flow: onboarding runs before the capture
   * flow exists, and what someone reads before agreeing stays their business.
   */
  const [reading, setReading] = useState<LegalDocumentKind | null>(null);
  const { t } = props;
  const step = STEPS[index] ?? 'welcome';
  const isLast = index === STEPS.length - 1;

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

  /*
   * The last screen explains the one-time download. Where the system has
   * already delivered the model — an asset pack with the install — there is
   * nothing to explain, and the microphone step is the end.
   */
  const endsAfterMicrophone = props.model.kind === 'ready';

  const advance = (): void => {
    if (step === 'microphone') {
      // The answer does not gate anything: someone who says no still has a
      // working journal, and asking twice would be worse than either outcome.
      void props.onAskMicrophone().finally(() => {
        if (endsAfterMicrophone) {
          props.onDone();
        } else {
          setIndex(index + 1);
        }
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
      <ProgressRail reached={index} of={STEPS.length} />

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
        {step === 'microphone' ? (
          <>
            <Lede>{t('onboarding.micBody')}</Lede>
            <ModelProgress state={props.model} t={t} />
          </>
        ) : null}
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
            <DownloadCard state={props.model} t={t} />
          </>
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <Button label={t(ACTION[step])} onPress={advance} />
        {/* The drawing gives the download screen no way out but "understood":
            there is nothing to skip, only something to know. */}
        {step === 'model' ? null : (
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
 * Three marks rather than "1 of 3". The rail says how much is left without
 * asking anyone to read a number before they have been told anything.
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
 * Progress, never a gate. Half a gigabyte over a phone connection is the wrong
 * thing to make someone wait for before their first entry, and the text path
 * needs none of it.
 */
/**
 * The drawing's tinted card on the download screen: the line with its
 * percentage over a three-point bar the ink fills. Where the model is already
 * whole it simply says so.
 */
function DownloadCard(props: {
  readonly state: SpeechModelState;
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();
  const percent =
    props.state.kind === 'fetching' && props.state.totalBytes !== null && props.state.totalBytes > 0
      ? Math.min(99, Math.floor((props.state.writtenBytes / props.state.totalBytes) * 100))
      : props.state.kind === 'ready'
        ? 100
        : null;

  return (
    <View
      style={{
        gap: 9,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: theme.palette.limeSoft,
      }}
    >
      <AppText variant="caption" color="inkSoft" style={{ textTransform: 'none', letterSpacing: 0 }}>
        {props.state.kind === 'ready'
          ? props.t('onboarding.downloadReady')
          : percent === null
            ? props.t('home.voiceFetching')
            : `${props.t('home.voiceFetching')} · ${String(percent)}%`}
      </AppText>
      <View
        style={{ height: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.10)', overflow: 'hidden' }}
      >
        <View
          style={{
            height: 3,
            width: `${percent ?? 0}%`,
            borderRadius: 999,
            backgroundColor: theme.palette.ink,
          }}
        />
      </View>
    </View>
  );
}

function ModelProgress(props: {
  readonly state: SpeechModelState;
  readonly t: Translate;
}): React.JSX.Element | null {
  const theme = useTheme();

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
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="secondary" color="inkSoft">
        {props.t('onboarding.downloading', { done, total })}
      </AppText>
      <AppText variant="secondary" color="inkFaint">
        {props.t('onboarding.downloadLater')}
      </AppText>
    </View>
  );
}
