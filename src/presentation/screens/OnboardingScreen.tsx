import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { SpeechModelState } from '@/domain/ports/ISpeechModel';
import type { SpeechEngine } from '@/domain/speech/SpeechEngine';
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
 * The download comes last, as the drawing has it, and only for people whose
 * language needs the model: the phone reads English by itself, and asking
 * someone for 668 MB they will never use is where the app ends for them.
 * The tap on that screen is the consent to the transfer over whatever
 * connection the phone is on — nothing downloads before it. Where the system
 * delivered the model with the install there is nothing to ask either.
 */
const WITH_DOWNLOAD: readonly Step[] = ['welcome', 'privacy', 'microphone', 'model'];
const WITHOUT_MODEL: readonly Step[] = ['welcome', 'privacy', 'microphone'];

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

/** The drawing's side margin on these screens. */
const SIDE_INSET = 28;

const ACTION: Record<Step, TranslationKey> = {
  welcome: 'onboarding.welcomeAction',
  model: 'onboarding.modelAction',
  privacy: 'onboarding.privacyAction',
  microphone: 'onboarding.micContinue',
};

/**
 * The screens before the first entry, in the order §8 asks for: what this is,
 * the one download and the tap that starts it, what happens to your voice,
 * and only then the microphone. Being asked for a microphone by something
 * that has not said where the recording goes is the moment people decide an
 * app is not trustworthy.
 *
 * The frame never moves: rail, kicker, then the button in the same place.
 * Only the middle changes, so the screens read as one thing with an end
 * rather than separate demands. Only the model screen has a second button:
 * the privacy screen is where the person agrees to the text of an entry
 * going to the analysis (App Review 5.1.2(i) wants that said and agreed to
 * before anything is sent), so nothing may skip past it, and the last screen
 * leads only into the system's microphone question (5.1.1(iv)).
 */
export function OnboardingScreen(props: {
  readonly t: Translate;
  readonly locale: Locale;
  readonly model: SpeechModelState;
  /** What will read this person's takes; `apple` needs no download at all. */
  readonly engine: SpeechEngine;
  /** Starts the one-time download. Called from the tap that means it, never on its own. */
  readonly onFetchModel: () => void;
  readonly onAskMicrophone: () => Promise<PermissionStatus>;
  readonly onDone: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  /*
   * Read as it stands rather than remembered from the first render: the
   * system may deliver the model while the welcome screen is up — a pack
   * that came with the install is found a moment after launch — and the
   * download step must then not be asked of anyone.
   */
  const steps = props.engine === 'apple' || props.model.kind === 'ready' ? WITHOUT_MODEL : WITH_DOWNLOAD;
  const index = Math.max(0, steps.indexOf(step));
  /*
   * The terms or the privacy policy, opened from the first screen's footer.
   * Held here rather than in the flow: onboarding runs before the capture
   * flow exists, and what someone reads before agreeing stays their business.
   */
  const [reading, setReading] = useState<LegalDocumentKind | null>(null);
  const { t } = props;
  const isLast = index === steps.length - 1;
  const modelReady = props.model.kind === 'ready';

  /* Landed while the download screen was up: there is nothing left to ask. */
  useEffect(() => {
    // The download finished under the last screen: there is nothing left to say.
    if (step === 'model' && modelReady) {
      props.onDone();
    }
  }, [modelReady, props, step]);

  const next = (): Step => steps[index + 1] ?? 'microphone';

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

  /* Whether the tap that starts the download has been made. */
  const fetching = props.model.kind === 'fetching' || props.model.kind === 'failed';

  const advance = (): void => {
    if (step === 'model') {
      if (fetching) {
        // The transfer runs on under home, which carries its progress from here.
        props.onDone();

        return;
      }

      // The tap is the consent; the screen stays to show the transfer start.
      props.onFetchModel();

      return;
    }

    if (step === 'microphone') {
      // The answer does not gate anything: someone who says no still has a
      // working journal, and asking twice would be worse than either outcome.
      void props.onAskMicrophone().finally(() => {
        if (isLast) {
          props.onDone();
        } else {
          setStep(next());
        }
      });

      return;
    }

    if (!isLast) {
      setStep(next());

      return;
    }

    props.onDone();
  };

  return (
    <Screen inset={{ top: 74, sides: SIDE_INSET, bottom: 40 }} style={{ gap: 0 }}>
      <ProgressRail reached={index} of={steps.length} />

      <AppText variant="kicker" style={{ marginTop: 24 }}>
        {t(KICKER[step])}
      </AppText>

      {/* Centred where there is room, scrolling where there is not: an SE holds
          neither the model screen nor the privacy screen in one view, and a
          headline hidden under the button was how the third review saw them. */}
      <ScrollView
        /* The scroller reaches into the side margins so the headline's blob,
           drawn past the text's left edge, is not clipped at the margin. */
        style={{ flex: 1, marginHorizontal: -SIDE_INSET }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          gap: step === 'welcome' ? 34 : 26,
          paddingTop: 20,
          paddingBottom: 16,
          paddingHorizontal: SIDE_INSET,
        }}
        showsVerticalScrollIndicator={false}
      >
        {step === 'welcome' ? (
          <WaveMark width={214} color={theme.palette.ink} echoColor={theme.palette.accent} />
        ) : null}
        <Headline>{t(HEADLINE[step])}</Headline>
        {step === 'welcome' ? <Lede>{t('onboarding.welcomeBody')}</Lede> : null}
        {step === 'model' ? (
          <>
            <View style={{ gap: 16, maxWidth: 320 }}>
              <AppText variant="body" color="ink" style={{ fontSize: 16, lineHeight: 25 }}>
                {t('onboarding.modelWhy')}
              </AppText>
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
            {fetching ? <ProgressCard model={props.model} t={t} /> : <SizeCard t={t} />}
          </>
        ) : null}
        {step === 'privacy' ? (
          <View style={{ gap: 18, maxWidth: 320 }}>
            <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
              {t('onboarding.privacyOnDevice')}
            </AppText>
            <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
              {t('onboarding.privacyAi')}
            </AppText>
            <AppText variant="body" color="inkSoft" style={{ fontSize: 16, lineHeight: 25 }}>
              {t('onboarding.privacyKeep')}
            </AppText>
          </View>
        ) : null}
        {step === 'microphone' ? <Lede>{t('onboarding.micBody')}</Lede> : null}
      </ScrollView>

      <View style={{ gap: 4 }}>
        <Button
          label={t(step === 'model' && fetching ? 'onboarding.modelDone' : ACTION[step])}
          onPress={advance}
        />
        {step === 'model' && !fetching ? (
          /* Consent has to be refusable. Later is home, which offers the
             download again in its own line. */
          <Button label={t('onboarding.modelLater')} variant="ghost" onPress={props.onDone} />
        ) : null}
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
/**
 * The drawing's download state on the last screen: the line with its
 * percentage and a hairline the ink fills, in the same card the size sat in
 * before the tap. A failure is said in the same place; home offers the retry.
 */
function ProgressCard(props: { readonly model: SpeechModelState; readonly t: Translate }): React.JSX.Element {
  const theme = useTheme();
  const percent =
    props.model.kind === 'fetching' && props.model.totalBytes !== null && props.model.totalBytes > 0
      ? Math.min(99, Math.floor((props.model.writtenBytes / props.model.totalBytes) * 100))
      : null;
  const line =
    props.model.kind === 'failed'
      ? props.t('home.voiceFailed')
      : percent === null
        ? props.t('home.voiceFetching')
        : `${props.t('home.voiceFetching')} · ${String(percent)}%`;

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
      <AppText variant="secondary" color="inkSoft" style={{ fontSize: 13.5, lineHeight: 19 }}>
        {line}
      </AppText>
      {props.model.kind === 'failed' ? null : (
        <View
          style={{
            height: 3,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.10)',
            overflow: 'hidden',
          }}
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
      )}
    </View>
  );
}

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
