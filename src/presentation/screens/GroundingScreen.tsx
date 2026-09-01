import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Translate, TranslationKey } from '@/i18n';

import { AppText } from '../components/AppText';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/** Five things seen, four heard, three felt — the drawing's shortened 5-4-3. */
const STEPS: readonly {
  readonly ordinal: TranslationKey;
  readonly instruction: TranslationKey;
  readonly count: number;
}[] = [
  { ordinal: 'ground.ord1', instruction: 'ground.step1', count: 5 },
  { ordinal: 'ground.ord2', instruction: 'ground.step2', count: 4 },
  { ordinal: 'ground.ord3', instruction: 'ground.step3', count: 3 },
];

/** Filling the last circle breathes for a moment before moving on. */
const ADVANCE_AFTER_MS = 1500;

/**
 * A minute of being where the body is, offered after an entry that sounded
 * overwhelmed. Three instructions, a column of circles, and a promise the
 * implementation keeps to the letter: **nothing here is recorded** — the
 * words are said to the room, the taps live in component state, and leaving
 * the screen leaves nothing behind. No repository, no analytics, no log.
 *
 * The drawing's prototype also listened for the words; this build counts
 * taps only. Speaking stays a human act the phone does not capture, which
 * is a stricter reading of the same promise.
 */
export function GroundingScreen(props: {
  readonly t: Translate;
  readonly onLeave: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  const [stepIndex, setStepIndex] = useState(0);
  const [filled, setFilled] = useState(0);
  const [done, setDone] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = STEPS[stepIndex] ?? STEPS[0];

  useEffect(
    () => () => {
      if (advance.current !== null) {
        clearTimeout(advance.current);
      }
    },
    [],
  );

  const goNext = () => {
    if (advance.current !== null) {
      clearTimeout(advance.current);
      advance.current = null;
    }

    if (stepIndex >= STEPS.length - 1) {
      setDone(true);

      return;
    }

    setStepIndex(stepIndex + 1);
    setFilled(0);
  };

  const fillOne = () => {
    if (step === undefined || filled >= step.count) {
      return;
    }

    const now = filled + 1;

    setFilled(now);

    if (now === step.count) {
      advance.current = setTimeout(goNext, ADVANCE_AFTER_MS);
    }
  };

  if (done || step === undefined) {
    return (
      <Screen>
        <View style={{ flex: 1 }} />
        <AppText variant="kicker" style={{ fontSize: 27, lineHeight: 35, marginBottom: 18 }}>
          {t('ground.endLine')}
        </AppText>
        <AppText variant="secondary" color="inkSoft">
          {t('ground.endFact')}
        </AppText>
        <View style={{ flex: 1.4 }} />
        <Pressable
          accessibilityRole="button"
          onPress={props.onLeave}
          style={{
            borderRadius: 999,
            backgroundColor: theme.palette.solid,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <AppText variant="body" style={{ color: theme.palette.onSolid }}>
            {t('ground.home')}
          </AppText>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 34,
        }}
      >
        <AppText variant="caption" color="inkFaint">
          {t(step.ordinal)}
        </AppText>
        <Pressable accessibilityRole="button" onPress={props.onLeave} hitSlop={10}>
          <AppText variant="secondary" color="inkFaint">
            {t('ground.quit')}
          </AppText>
        </Pressable>
      </View>

      <AppText variant="kicker" style={{ fontSize: 27, lineHeight: 34, marginBottom: 14 }}>
        {t(step.instruction)}
      </AppText>
      <AppText variant="secondary" color="inkSoft" style={{ marginBottom: 34 }}>
        {t('ground.hint')}
      </AppText>

      <View style={{ gap: 16 }}>
        {Array.from({ length: step.count }, (_unused, at) => (
          <Pressable
            key={`${stepIndex}-${at}`}
            accessibilityRole="button"
            onPress={fillOne}
            hitSlop={10}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <View
              style={
                at < filled
                  ? {
                      width: 26,
                      height: 26,
                      borderRadius: 26,
                      backgroundColor: theme.palette.solid,
                    }
                  : {
                      width: 26,
                      height: 26,
                      borderRadius: 26,
                      borderWidth: 1.5,
                      borderColor: theme.palette.inkFaint,
                    }
              }
            />
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="button"
        onPress={goNext}
        style={{
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.palette.lineStrong,
          paddingVertical: 16,
          alignItems: 'center',
        }}
      >
        <AppText variant="body">{t('ground.next')}</AppText>
      </Pressable>
    </Screen>
  );
}
