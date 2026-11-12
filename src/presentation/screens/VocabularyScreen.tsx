import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { EmotionCount, VocabularyGrowth } from '@/application/use-cases/GetVocabularyGrowth';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { type Locale, type Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import type { EntryDays } from '../components/entryDays';
import { PeriodSheet } from '../components/PeriodSheet';
import { periodLabel, type Period } from '../components/periodLabel';
import { RoundBack } from '../components/RoundBack';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, emotionTint } from '../components/emotionDisplay';

/**
 * Which emotions the person's entries held, and how often — the most frequent
 * on top (owner's word, 2026-10-13, in place of the words named for the first
 * time). The trades for a more exact word went on 2026-10-20 with the levels
 * of the vocabulary: in a flat list no word is finer than another.
 *
 * Its own screen rather than a section under the week, because the two answer
 * different questions and the week would always win the attention.
 */
export function VocabularyScreen(props: {
  readonly growth: VocabularyGrowth;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly today: Date;
  /** The first entry ever written. Nothing before it is worth offering. */
  readonly earliest: Date;
  /** The days with entries, which the calendar dots. */
  readonly entryDays: EntryDays;
  readonly t: Translate;
  readonly onSeeWeek: () => void;
  readonly onPeriodChange: (period: Period) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const [pickingPeriod, setPickingPeriod] = useState(false);
  const { growth, t } = props;

  const label = (id: string): string => emotionLabel(id, t);
  const colourOf = (id: string): string => {
    return emotionTint(id, props.vocabulary, theme) ?? theme.palette.inkSoft;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: 40 }}
    >
      {/* Back to the week, which is where this screen is reached from. */}
      <RoundBack t={t} onPress={props.onSeeWeek} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 6,
        }}
      >
        {/* Shrinks before the pill moves: the title may wrap, the margin may not. */}
        <AppText variant="display" style={{ flexShrink: 1 }}>
          {t('dict.title')}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dict.rangeTitle')}
          onPress={() => {
            setPickingPeriod(true);
          }}
          style={{
            borderWidth: 1,
            borderColor: theme.palette.line,
            backgroundColor: theme.palette.paper,
            borderRadius: 999,
            height: 40,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}
        >
          <AppText variant="secondary">
            {periodLabel(growth, props.locale, { earliest: props.earliest, today: props.today })}
          </AppText>
        </Pressable>
      </View>
      <Frequencies counts={growth.counts} label={label} colourOf={colourOf} t={t} />

      <PeriodSheet
        open={pickingPeriod}
        period={{ from: growth.from, to: growth.to }}
        today={props.today}
        earliest={props.earliest}
        entryDays={props.entryDays}
        locale={props.locale}
        t={t}
        onApply={(period) => {
          setPickingPeriod(false);
          props.onPeriodChange(period);
        }}
        onClose={() => {
          setPickingPeriod(false);
        }}
      />
    </ScrollView>
  );
}

/**
 * One row per emotion: its name, how many entries held it, and a bar measured
 * against the most frequent one, in the emotion's own colour. The longest bar
 * is always full, so the eye reads the order before it reads a number.
 */
function Frequencies(props: {
  readonly counts: readonly EmotionCount[];
  readonly label: (id: string) => string;
  readonly colourOf: (id: string) => string;
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();
  const most = props.counts[0]?.count ?? 0;

  if (most === 0) {
    return (
      <AppText variant="body" color="inkSoft" style={{ marginTop: 24, marginBottom: 26 }}>
        {props.t('dict.countsEmpty')}
      </AppText>
    );
  }

  return (
    <View style={{ gap: 16, marginTop: 24, marginBottom: 28 }}>
      {props.counts.map(({ id, count }) => (
        <View key={id} accessible accessibilityLabel={`${props.label(id)}: ${count}`} style={{ gap: 7 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <AppText variant="body" style={{ flexShrink: 1 }}>
              {props.label(id)}
            </AppText>
            <AppText variant="numeric" color="inkSoft" style={{ fontSize: 15 }}>
              {String(count)}
            </AppText>
          </View>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.palette.line,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${(count / most) * 100}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: props.colourOf(id),
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
