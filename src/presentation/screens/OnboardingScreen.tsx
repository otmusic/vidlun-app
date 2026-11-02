import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';

import type { PermissionStatus } from '@/domain/ports/IMicrophonePermission';
import type { Locale, Translate, TranslationKey } from '@/i18n';
import { legalDocument, type LegalDocumentKind } from '@/i18n/legal';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { WaveMark, waveMarkHeight } from '../components/WaveMark';
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

const MARK_WIDTH = 214;

/** See Headline: the most the onboarding headlines grow with larger text. */
const HEADLINE_SCALE_CAP = 1.1;

/** The middle's spacing, kept apart so the room the mark needs can be counted. */
const WELCOME_GAP = 34;
const STEP_GAP = 26;
const MIDDLE_PAD_TOP = 20;
const MIDDLE_PAD_BOTTOM = 16;

/** The footer's pair, side by side with a dot between when they fit. */
const LINK_GAP = 12;
const LINK_DOT = 3;

/*
 * How far the pair may run past the footer's own padding. On an SE at the
 * default size the Ukrainian pair is a few points wider than the text above
 * it and always reached into the margin; this keeps it in one row there.
 */
const LINK_OVERHANG = 12;

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
  /*
   * The scroller's height and the words' height, without the mark. Large
   * text on an SE-sized window — and on an iPad, which shows an iPhone app in
   * one — left no room for the mark and the words, and it was the words that
   * went under the button (owner's iPad, 2026-11-02). The mark is the only
   * decoration here, so it is what gives way. The words are kept without the
   * mark and without the gap between them, which changes with it, so taking
   * the mark away cannot make it fit again.
   */
  const [room, setRoom] = useState<number | null>(null);
  const [words, setWords] = useState<number | null>(null);
  const scroller = useRef<ScrollView>(null);
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

  const markFits =
    room === null ||
    words === null ||
    waveMarkHeight(MARK_WIDTH) + 2 * WELCOME_GAP + words + MIDDLE_PAD_TOP + MIDDLE_PAD_BOTTOM <= room;
  const showMark = step === 'welcome' && markFits;
  // Without the mark the welcome is a headline over a lede, as the other two are.
  const gap = showMark ? WELCOME_GAP : STEP_GAP;

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
        ref={scroller}
        /* The scroller reaches into the side margins so the headline's blob,
           drawn past the text's left edge, is not clipped at the margin. */
        style={{ flex: 1, marginHorizontal: -SIDE_INSET }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          gap,
          paddingTop: MIDDLE_PAD_TOP,
          paddingBottom: MIDDLE_PAD_BOTTOM,
          paddingHorizontal: SIDE_INSET,
        }}
        onLayout={(event: LayoutChangeEvent) => {
          setRoom(event.nativeEvent.layout.height);
        }}
        onContentSizeChange={(_width, height) => {
          // Words that still do not fit, at the largest sizes, say there is more.
          if (room !== null && height > room) {
            scroller.current?.flashScrollIndicators();
          }
        }}
      >
        {showMark ? (
          <WaveMark width={MARK_WIDTH} color={theme.palette.ink} echoColor={theme.palette.accent} />
        ) : null}
        <View
          style={{ gap }}
          onLayout={(event: LayoutChangeEvent) => {
            // A headline and a lede on every step: one gap between them.
            setWords(event.nativeEvent.layout.height - gap);
          }}
        >
          <Headline>{t(HEADLINE[step])}</Headline>
          {step === 'welcome' ? <Lede>{t('onboarding.welcomeBody')}</Lede> : null}
          {step === 'privacy' ? <Lede>{t('onboarding.privacyOnDevice')}</Lede> : null}
          {step === 'microphone' ? <Lede>{t('onboarding.micBody')}</Lede> : null}
        </View>
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
          <FooterLinks
            terms={t('onboarding.legalTerms')}
            privacy={t('onboarding.legalPrivacy')}
            onRead={setReading}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * The terms and the policy side by side, or one under the other when larger
 * text makes the pair wider than the screen: in a row they ran off both edges
 * (owner's iPad, 2026-11-02). Measured rather than wrapped, so the dot never
 * ends a line, and the links' own widths decide, so the choice cannot undo
 * itself.
 */
function FooterLinks(props: {
  readonly terms: string;
  readonly privacy: string;
  readonly onRead: (kind: LegalDocumentKind) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [room, setRoom] = useState(0);
  const [terms, setTerms] = useState(0);
  const [privacy, setPrivacy] = useState(0);
  const together = room === 0 || terms + privacy + 2 * LINK_GAP + LINK_DOT <= room;

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => {
        setRoom(event.nativeEvent.layout.width);
      }}
      style={{
        alignSelf: 'stretch',
        marginHorizontal: -LINK_OVERHANG,
        flexDirection: together ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: together ? LINK_GAP : 8,
      }}
    >
      <FooterLink
        label={props.terms}
        onWidth={setTerms}
        onPress={() => {
          props.onRead('terms');
        }}
      />
      {together ? (
        <View
          style={{
            width: LINK_DOT,
            height: LINK_DOT,
            borderRadius: 999,
            backgroundColor: theme.palette.line,
          }}
        />
      ) : null}
      <FooterLink
        label={props.privacy}
        onWidth={setPrivacy}
        onPress={() => {
          props.onRead('privacy');
        }}
      />
    </View>
  );
}

/** A quiet underlined link, as the drawing sets the footer's pair. */
function FooterLink(props: {
  readonly label: string;
  readonly onWidth: (width: number) => void;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      onPress={props.onPress}
      hitSlop={10}
      onLayout={(event: LayoutChangeEvent) => {
        props.onWidth(event.nativeEvent.layout.width);
      }}
    >
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
/**
 * The headline alone: the lime blob the drawing put behind it went at the
 * owner's request. It grows less with large text than a hero elsewhere:
 * the privacy headline's longest Ukrainian word, at the hero's own cap, no
 * longer fit an SE-wide window and broke one letter before its end
 * (2026-11-02).
 */
function Headline(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <AppText variant="hero" maxScale={HEADLINE_SCALE_CAP}>
        {props.children}
      </AppText>
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
