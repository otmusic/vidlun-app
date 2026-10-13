import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { EmotionCount, VocabularyGrowth } from '@/application/use-cases/GetVocabularyGrowth';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { type Locale, type Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { PeriodSheet, type Period } from '../components/PeriodSheet';
import { RoundBack } from '../components/RoundBack';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { emotionLabel, emotionTint } from '../components/emotionDisplay';

/**
 * Which emotions the person's entries held, and how often — the most frequent
 * on top (owner's word, 2026-10-13, in place of the words named for the first
 * time). Under it, the trades for a more exact word and Vidlun's sentence about
 * them, each only when there is one.
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
          <AppText variant="secondary">{periodLabel(growth, props.locale)}</AppText>
        </Pressable>
      </View>
      <Frequencies counts={growth.counts} label={label} colourOf={colourOf} t={t} />

      {growth.refinements.length === 0 ? null : (
        <>
          <AppText variant="caption" color="inkFaint" style={{ marginBottom: 14 }}>
            {t('stats.refineTitle')}
          </AppText>
          <View style={{ gap: 10, marginBottom: 16 }}>
            {growth.refinements.map((pair) => (
              <View
                key={pair.toId}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                {/*
                  The broad word is faint and the exact one is a pill in its own
                  colour: the sentence being made is "this became that", and
                  giving both equal weight would read as a pair of options.
                */}
                <AppText variant="body" color="inkFaint">
                  {label(pair.fromId)}
                </AppText>
                <AppText variant="body" color="inkFaint">
                  →
                </AppText>
                <Outlined label={label(pair.toId)} colour={colourOf(pair.toId)} />
              </View>
            ))}
          </View>
          <AppText variant="body" color="inkSoft" style={{ marginBottom: 28 }}>
            {t(growth.wide ? 'dict.refineLinePeriod' : 'stats.refineLine', {
              n: growth.preciseCount,
              m: growth.distinctCount,
            })}
          </AppText>
        </>
      )}

      <Prose
        growth={growth}
        label={label}
        locale={props.locale}
        t={t}
      />

      <PeriodSheet
        open={pickingPeriod}
        period={{ from: growth.from, to: growth.to }}
        today={props.today}
        earliest={props.earliest}
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

/**
 * The one place on this screen that speaks in sentences, and the reason it is
 * a dark panel: it reads as Vidlun's voice rather than as another count.
 *
 * It says nothing at all unless something changed. A panel that appears every
 * month with a sentence built from an empty list would be exactly the
 * fabricated insight §5 forbids.
 */
function Prose(props: {
  readonly growth: VocabularyGrowth;
  readonly label: (id: string) => string;
  readonly locale: Locale;
  readonly t: Translate;
}): React.JSX.Element | null {
  const theme = useTheme();
  const { growth, t } = props;
  const first = growth.months[0];

  // Nothing measured, nothing said. A panel that appeared every month with a
  // sentence built from an empty list is the fabricated insight §5 forbids.
  if (growth.widening === null && growth.refinements.length === 0) {
    return null;
  }

  const heading =
    growth.months.length === 1 && first !== undefined
      ? first.monthStart.toLocaleDateString(props.locale, { month: 'long' })
      : t(countedKey('dict.overMonths', growth.months.length, props.locale), {
          n: growth.months.length,
        });

  const { widening } = growth;

  /*
   * The widening sentence only runs when the widening was measured — root and
   * all. Otherwise the pair sentence, which needs no claim about the past
   * beyond the pair itself.
   */
  const body =
    widening === null
      ? t('dict.proseRefine', {
          from: props.label(growth.refinements[0]?.fromId ?? ''),
          to: props.label(growth.refinements[0]?.toId ?? ''),
        })
      : t('dict.proseNew', {
          m:
            first === undefined
              ? ''
              : first.monthStart.toLocaleDateString(props.locale, { month: 'long' }),
          root: props.label(widening.rootId),
          list: listOf(widening.intoIds.slice(0, 3).map(props.label), t),
        });

  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: theme.palette.panel,
        padding: 22,
        marginBottom: 26,
        gap: 12,
      }}
    >
      <AppText variant="caption" style={{ color: theme.palette.onPanel, opacity: 0.6 }}>
        {heading}
      </AppText>
      <AppText variant="quote" style={{ color: theme.palette.onPanel }}>
        {body}
      </AppText>
    </View>
  );
}

/** "a, b and c" — the conjunction is a word, so it lives in the locale files. */
function listOf(words: readonly string[], t: Translate): string {
  if (words.length <= 1) {
    return words[0] ?? '';
  }

  return `${words.slice(0, -1).join(', ')} ${t('common.and')} ${words[words.length - 1] ?? ''}`;
}

function periodLabel(growth: VocabularyGrowth, locale: Locale): string {
  const last = new Date(growth.to.getTime());

  last.setDate(last.getDate() - 1);

  // Short in both shapes: the pill shares its row with the title, and a full
  // month name is what used to push it past the screen's own margin.
  return growth.wide
    ? `${growth.from.toLocaleDateString(locale, { month: 'short' })} – ${last.toLocaleDateString(locale, { month: 'short' })}`
    : growth.from.toLocaleDateString(locale, { month: 'short' });
}

/**
 * Outlined in the word's own colour rather than filled with it. A filled chip
 * is a thing you chose; these are things you found, and the difference is
 * worth a border.
 */
function Outlined(props: { readonly label: string; readonly colour: string }): React.JSX.Element {
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: props.colour,
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 16,
      }}
    >
      <AppText variant="body" style={{ color: props.colour }}>
        {props.label}
      </AppText>
    </View>
  );
}
