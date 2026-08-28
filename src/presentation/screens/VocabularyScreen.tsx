import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { VocabularyGrowth } from '@/application/use-cases/GetVocabularyGrowth';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { emotionKey, type Locale, type Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { PeriodSheet, type Period } from '../components/PeriodSheet';
import { RoundBack } from '../components/RoundBack';
import { colorForEmotion } from '../theme/emotionColor';
import { useTheme } from '../theme/ThemeProvider';

/** Four fit a row on the narrowest phone before the list starts wrapping oddly. */
const SHOWN_WORDS = 4;

/**
 * How many different words this person finds for what they feel — §M6's core
 * value signal, and the half of the insights screen the product exists for.
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
  const scheme = theme.isDark ? 'dark' : 'light';
  const [pickingPeriod, setPickingPeriod] = useState(false);
  const { growth, t } = props;

  const label = (id: string): string => t(emotionKey(id));
  const colourOf = (id: string): string => {
    const emotion = props.vocabulary.find(id);

    return emotion === undefined
      ? theme.palette.inkSoft
      : colorForEmotion(props.vocabulary, emotion, scheme);
  };

  const shown = growth.firstTimeIds.slice(0, SHOWN_WORDS);
  const rest = growth.firstTimeIds.length - shown.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: 40 }}
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
        <AppText variant="display">{t('dict.title')}</AppText>
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
      <AppText variant="body" color="inkSoft" style={{ marginBottom: 30 }}>
        {t('dict.purpose')}
      </AppText>

      <AppText variant="kicker" style={{ marginBottom: 16 }}>
        {t(growth.wide ? 'dict.newWordsTitlePeriod' : 'stats.newWordsTitle')}
      </AppText>

      {shown.length === 0 ? (
        <AppText variant="body" color="inkSoft" style={{ marginBottom: 26 }}>
          {t(growth.wide ? 'dict.noNewWordsPeriod' : 'stats.noNewWords')}
        </AppText>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginBottom: 26,
          }}
        >
          {shown.map((id) => (
            <Outlined key={id} label={label(id)} colour={colourOf(id)} />
          ))}
          {rest > 0 ? (
            <AppText variant="body" color="inkSoft">
              {t('stats.newWordsMore', { n: rest })}
            </AppText>
          ) : null}
        </View>
      )}

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.palette.line,
          paddingTop: 18,
          marginBottom: 26,
        }}
      >
        <AppText variant="body" color="inkSoft">
          {t('dict.perMonth', { m: monthsLine(growth, props.locale) })}
        </AppText>
      </View>

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

      <Pressable
        accessibilityRole="button"
        onPress={props.onSeeWeek}
        style={{
          borderWidth: 1,
          borderColor: theme.palette.line,
          backgroundColor: theme.palette.paper,
          borderRadius: 999,
          paddingVertical: 15,
          alignItems: 'center',
        }}
      >
        <AppText variant="body">{t('dict.seeWeek')}</AppText>
      </Pressable>

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

/**
 * One month per segment, so the line reads as a shape over time rather than a
 * single number: four words in April, six in May, nine in June is a sentence
 * about someone; "nineteen" is not.
 */
function monthsLine(growth: VocabularyGrowth, locale: Locale): string {
  return growth.months
    .map(
      (month) =>
        `${month.monthStart.toLocaleDateString(locale, { month: 'short' })} ${String(month.distinctCount)}`,
    )
    .join(' · ');
}

function periodLabel(growth: VocabularyGrowth, locale: Locale): string {
  const last = new Date(growth.to.getTime());

  last.setDate(last.getDate() - 1);

  return growth.wide
    ? `${growth.from.toLocaleDateString(locale, { month: 'short' })} – ${last.toLocaleDateString(locale, { month: 'short' })}`
    : growth.from.toLocaleDateString(locale, { month: 'long' });
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
