import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import type { Locale, Translate, TranslationKey } from '@/i18n';

import { AppText } from './AppText';
import { useTheme } from '../theme/ThemeProvider';

/** A period, `from` inclusive and `to` exclusive, matching the use case. */
export interface Period {
  readonly from: Date;
  readonly to: Date;
}

const COLUMNS = 7;

/** Six rows of seven always hold a month, whichever weekday it starts on. */
const CELLS = 42;

interface Preset {
  readonly key: TranslationKey;
  readonly period: (today: Date) => Period;
}

/**
 * Named stretches rather than dates, because the honest answer to "how far
 * back" is usually a phrase and not a calendar. The calendar is underneath for
 * the times it is not.
 */
const PRESETS: readonly Preset[] = [
  {
    key: 'dict.presetMonth',
    period: (today) => ({ from: startOfMonth(today), to: tomorrow(today) }),
  },
  {
    key: 'dict.presetPrev',
    period: (today) => ({
      from: addMonths(startOfMonth(today), -1),
      to: startOfMonth(today),
    }),
  },
  {
    key: 'dict.presetQuarter',
    period: (today) => ({ from: addMonths(startOfMonth(today), -2), to: tomorrow(today) }),
  },
  {
    // Far enough back to hold any journal, and clamped by the entries anyway.
    key: 'dict.presetAll',
    period: (today) => ({ from: new Date(2000, 0, 1), to: tomorrow(today) }),
  },
];

/**
 * Picking the stretch of time the vocabulary is counted over.
 *
 * A sheet rather than a screen: choosing a period is a detour from reading,
 * and coming back to exactly where you were is the whole point of one.
 */
export function PeriodSheet(props: {
  readonly open: boolean;
  readonly period: Period;
  readonly today: Date;
  /** Nothing before the first entry is pickable — there is nothing there. */
  readonly earliest: Date;
  readonly locale: Locale;
  readonly t: Translate;
  readonly onApply: (period: Period) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  const [month, setMonth] = useState(() => startOfMonth(props.period.from));
  const [from, setFrom] = useState<Date | null>(props.period.from);
  const [to, setTo] = useState<Date | null>(addDays(props.period.to, -1));

  const pick = (day: Date): void => {
    /*
     * First tap starts a new range, second closes it. Tapping before the start
     * starts again rather than reversing: someone correcting their first tap
     * means the earlier day, not a backwards range.
     */
    if (from === null || to !== null || day < from) {
      setFrom(day);
      setTo(null);

      return;
    }

    setTo(day);
  };

  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={props.onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            backgroundColor: theme.palette.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            paddingHorizontal: 20,
            paddingBottom: 26,
          }}
        >
          <AppText variant="caption" color="inkFaint" style={{ marginBottom: 14 }}>
            {t('dict.rangeTitle')}
          </AppText>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
            {PRESETS.map((preset) => (
              <Pressable
                key={preset.key}
                accessibilityRole="button"
                onPress={() => {
                  props.onApply(preset.period(props.today));
                }}
                style={{
                  borderWidth: 1.5,
                  borderColor: theme.palette.line,
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                }}
              >
                <AppText variant="secondary">{t(preset.key)}</AppText>
              </Pressable>
            ))}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <CalendarStep
              glyph="‹"
              enabled={startOfMonth(props.earliest) < month}
              onPress={() => {
                setMonth(addMonths(month, -1));
              }}
            />
            <AppText variant="body">
              {month.toLocaleDateString(props.locale, { month: 'long', year: 'numeric' })}
            </AppText>
            <CalendarStep
              glyph="›"
              enabled={month < startOfMonth(props.today)}
              onPress={() => {
                setMonth(addMonths(month, 1));
              }}
            />
          </View>

          <Calendar
            month={month}
            from={from}
            to={to}
            earliest={props.earliest}
            today={props.today}
            locale={props.locale}
            onPick={pick}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <AppText variant="secondary" color="inkSoft" style={{ flex: 1 }}>
              {from === null
                ? t('dict.pickStart')
                : `${dayLabel(from, props.locale)} – ${to === null ? '…' : dayLabel(to, props.locale)}`}
            </AppText>
            {from !== null && to !== null ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  props.onApply({ from, to: addDays(to, 1) });
                }}
                style={{
                  borderRadius: 999,
                  backgroundColor: theme.palette.solid,
                  paddingVertical: 13,
                  paddingHorizontal: 24,
                }}
              >
                <AppText variant="body" style={{ color: theme.palette.onSolid }}>
                  {t('dict.apply')}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={props.onClose}
            style={{ paddingTop: 16, alignItems: 'center' }}
          >
            <AppText variant="body" color="inkFaint">
              {t('common.cancel')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Calendar(props: {
  readonly month: Date;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly earliest: Date;
  readonly today: Date;
  readonly locale: Locale;
  readonly onPick: (day: Date) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const first = startOfMonth(props.month);
  // Monday first: the week starts where the week strip starts.
  const lead = (first.getDay() + 6) % COLUMNS;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  return (
    <>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {Array.from({ length: COLUMNS }, (_unused, at) => (
          <AppText
            key={at}
            variant="caption"
            color="inkFaint"
            style={{ flex: 1, textAlign: 'center' }}
          >
            {addDays(mondayOf(first), at).toLocaleDateString(props.locale, { weekday: 'narrow' })}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: CELLS }, (_unused, at) => {
          const dayOfMonth = at - lead + 1;

          if (dayOfMonth < 1 || dayOfMonth > days) {
            return <View key={at} style={{ width: `${100 / COLUMNS}%`, aspectRatio: 1 }} />;
          }

          const day = new Date(first.getFullYear(), first.getMonth(), dayOfMonth);
          // By day at both ends: `today` arrives with the hour on it, so a
          // plain comparison put today itself in the future.
          const outside = day < startOfDay(props.earliest) || day > startOfDay(props.today);
          const edge = sameDay(day, props.from) || sameDay(day, props.to);
          const inside =
            props.from !== null && props.to !== null && day > props.from && day < props.to;

          return (
            <View key={at} style={{ width: `${100 / COLUMNS}%`, aspectRatio: 1, padding: 1.5 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={dayLabel(day, props.locale)}
                accessibilityState={{ disabled: outside, selected: edge }}
                disabled={outside}
                onPress={() => {
                  props.onPick(day);
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: edge ? 999 : 8,
                  backgroundColor: edge
                    ? theme.palette.solid
                    : inside
                      ? theme.palette.limeSoft
                      : 'transparent',
                  opacity: outside ? 0.55 : 1,
                }}
              >
                <AppText
                  variant="body"
                  style={{
                    color: edge
                      ? theme.palette.onSolid
                      : outside
                        ? theme.palette.inkFaint
                        : theme.palette.ink,
                  }}
                >
                  {String(dayOfMonth)}
                </AppText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </>
  );
}

function CalendarStep(props: {
  readonly glyph: string;
  readonly enabled: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const frame = {
    width: 32,
    height: 32,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (!props.enabled) {
    return (
      <View style={frame}>
        <AppText variant="secondary" color="inkFaint">
          {props.glyph}
        </AppText>
      </View>
    );
  }

  return (
    <Pressable accessibilityRole="button" onPress={props.onPress} hitSlop={8} style={frame}>
      <AppText variant="secondary">{props.glyph}</AppText>
    </Pressable>
  );
}

function sameDay(day: Date, other: Date | null): boolean {
  return other !== null && day.getTime() === other.getTime();
}

function dayLabel(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % COLUMNS));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date: Date, days: number): Date {
  const shifted = new Date(date.getTime());

  shifted.setDate(shifted.getDate() + days);

  return shifted;
}

function tomorrow(today: Date): Date {
  return addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), 1);
}
