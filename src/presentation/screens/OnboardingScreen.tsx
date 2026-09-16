import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { Locale, Translate, TranslationKey } from '@/i18n';
import { legalDocument, type LegalDocumentKind } from '@/i18n/legal';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { WaveMark } from '../components/WaveMark';
import { useTheme } from '../theme/ThemeProvider';
import { LegalScreen } from './LegalScreen';
import { Screen } from './Screen';

type Step = 'welcome' | 'privacy' | 'microphone';

/*
 * Three screens and no download: the model rides inside the app since 1.2,
 * so the first entry can be spoken the moment the microphone is granted.
 */
const STEPS: readonly Step[] = ['welcome', 'privacy', 'microphone'];

const KICKER: Record<Step, TranslationKey> = {
  welcome: 'onboarding.step1Kicker',
  privacy: 'onboarding.step2Kicker',
  microphone: 'onboarding.step3Kicker',
};

const HEADLINE: Record<Step, TranslationKey> = {
  welcome: 'onboarding.welcomeTitle',
  privacy: 'onboarding.privacyTitle',
  microphone: 'onboarding.micTitle',
};

/** The drawing's side margin on these screens. */
const SIDE_INSET = 28;

const ACTION: Record<Step, TranslationKey> = {
  welcome: 'onboarding.welcomeAction',
  privacy: 'onboarding.privacyAction',
  microphone: 'onboarding.micContinue',
};

/**
 * The screens before the first entry, in the order §8 asks for: what this is,
 * what happens to your voice, and only then the microphone. Being asked for
 * a microphone by something that has not said where the recording goes is
 * the moment people decide an app is not trustworthy.
 *
 * The frame never moves: rail, kicker, then the button in the same place.
 * Only the middle changes, so the screens read as one thing with an end
 * rather than separate demands. Each screen has one button: the privacy
 * screen is where the person agrees to the text of an entry going to the
 * analysis (App Review 5.1.2(i) wants that said and agreed to before
 * anything is sent), so nothing may skip past it, and the last screen leads
 * only into the system's microphone question (5.1.1(iv)).
 */
export function OnboardingScreen(props: {
  readonly t: Translate;
  readonly locale: Locale;
  readonly onAskMicrophone: () => Promise<PermissionStatus>;
  readonly onDone: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  const index = Math.max(0, STEPS.indexOf(step));
  /*
   * The terms or the privacy policy, opened from the first screen's footer.
   * Held here rather than in the flow: onboarding runs before the capture
   * flow exists, and what someone reads before agreeing stays their business.
   */
  const [reading, setReading] = useState<LegalDocumentKind | null>(null);
  const { t } = props;
  const isLast = index === STEPS.length - 1;

  const next = (): Step => STEPS[index + 1] ?? 'microphone';

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
      <ProgressRail reached={index} of={STEPS.length} />

      <AppText variant="kicker" style={{ marginTop: 24 }}>
        {t(KICKER[step])}
      </AppText>

      {/* Centred where there is room, scrolling where there is not: an SE does
          not hold the privacy screen in one view, and a headline hidden under
          the button was how the third review saw it. */}
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
        {step === 'privacy' ? <Lede>{t('onboarding.privacyOnDevice')}</Lede> : null}
        {step === 'microphone' ? <Lede>{t('onboarding.micBody')}</Lede> : null}
      </ScrollView>

      <View style={{ gap: 4 }}>
        <Button label={t(ACTION[step])} onPress={advance} />
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
/** The headline alone: the lime blob the drawing put behind it went at the owner's request. */
function Headline(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ alignSelf: 'flex-start' }}>
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
