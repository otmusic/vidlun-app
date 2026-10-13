import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View, type ListRenderItem } from 'react-native';

import type { HistoryDay } from '@/application/use-cases/GetHistory';
import type { Milestone } from '@/domain/entities/Milestone';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { Locale, Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { CountPill } from '../components/CountPill';
import { EmotionFilterSheet } from '../components/EmotionFilterSheet';
import { EntryCard } from '../components/EntryCard';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { WaveMark } from '../components/WaveMark';
import { emotionLabel } from '../components/emotionDisplay';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import { emotionsUsed, entriesWithAny } from './journalFilter';

/** The bar floats over this screen, so the last card needs room under it. */
const BOTTOM_ROOM = 118;

/**
 * The journal: every entry as a card, newest first.
 *
 * Flat rather than grouped by day, which is what the drawing has and what a
 * journal is — days with nothing in them are not headings with nothing under
 * them, they simply are not there.
 */
export function HistoryScreen(props: {
  readonly days: readonly HistoryDay[] | null;
  /** Entries that still have their audio; null while the files are being read. */
  readonly recorded: ReadonlySet<string> | null;
  /** The emotions the journal is narrowed to; empty shows every entry. */
  readonly filter: readonly string[];
  readonly onFilter: (emotionIds: readonly string[]) => void;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly today: Date;
  readonly t: Translate;
  readonly onOpen: (entry: MoodEntry) => void;
  readonly onRecord: () => void;
  /** Every milestone; each sits as a rule between the days before and after it. */
  readonly milestones: readonly Milestone[];
  readonly onEditMilestone: (milestone: Milestone) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const { t, onOpen, onEditMilestone } = props;
  const [filtering, setFiltering] = useState(false);
  const entries = useMemo(() => (props.days ?? []).flatMap((day) => day.entries), [props.days]);
  const offered = useMemo(() => emotionsUsed(entries), [entries]);
  const filtered = props.filter.length > 0;
  const shown = useMemo(() => entriesWithAny(entries, props.filter), [entries, props.filter]);
  // Sorted once per journal, not once per frame: a year of entries is a
  // few hundred rows, and the list re-renders on every scroll tick. The
  // milestones step aside while the journal is filtered: between a few
  // chosen days they would stand next to each other with nothing between.
  const rows = useMemo(
    () => interleave(shown, filtered ? [] : props.milestones),
    [shown, filtered, props.milestones],
  );

  const renderRow = useCallback<ListRenderItem<Row>>(
    ({ item: row }) =>
      row.kind === 'entry' ? (
        <EntryCard
          entry={row.entry}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          t={t}
          hasAudio={props.recorded?.has(row.entry.id)}
          onOpen={() => {
            onOpen(row.entry);
          }}
        />
      ) : (
        /* The drawing's rule with the milestone's name in it: the
           entries above came after, the ones below came before. */
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onEditMilestone(row.milestone);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 4 }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: theme.palette.ink, opacity: 0.35 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <AppText variant="secondary" style={{ fontSize: 13.5, fontWeight: '500' }}>
              {row.milestone.label}
            </AppText>
            <AppText variant="secondary" color="inkSoft" style={{ fontSize: 12.5 }}>
              {row.milestone.day.toLocaleDateString(props.locale, { day: 'numeric', month: 'long' })}
            </AppText>
          </View>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.palette.ink, opacity: 0.35 }} />
        </Pressable>
      ),
    [
      onEditMilestone,
      onOpen,
      props.locale,
      props.recorded,
      props.today,
      props.vocabulary,
      t,
      theme.palette.ink,
    ],
  );

  return (
    <View style={{ flex: 1 }}>
      {/*
       * A list that renders what is on screen and a little past it, rather
       * than every card the journal holds: the journal grows by one a day and
       * must not get slower for it.
       */}
      <FlatList
        data={rows}
        keyExtractor={keyOf}
        renderItem={renderRow}
        ItemSeparatorComponent={Gap}
        style={{ flex: 1, backgroundColor: theme.palette.canvas }}
        contentContainerStyle={{ paddingTop: top, ...sides, paddingBottom: BOTTOM_ROOM }}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={
          /*
           * The count of entries as home counts days (owner's word, 2026-10-01):
           * a pill opposite the title, moved here from the profile. It wraps
           * under the title at large type rather than clipping, and is absent
           * at zero, as home's is.
           */
          <View style={{ gap: 16, marginBottom: 26 }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <AppText variant="display">{t('feed.title')}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* What is listed: the filtered count while a filter is on. */}
              {shown.length === 0 ? null : (
                <CountPill
                  value={shown.length}
                  label={t(countedKey('feed.entry', shown.length, props.locale))}
                />
              )}
              {/*
                The filter (owner's word, 2026-10-13), in place of the search
                tab. While it narrows the list, a badge on it says how many
                emotions it holds, so a short journal never looks like a
                lost one.
              */}
              {offered.length === 0 ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('feed.filter')}
                  accessibilityState={{ selected: filtered }}
                  accessibilityValue={filtered ? { text: String(props.filter.length) } : undefined}
                  onPress={() => {
                    setFiltering(true);
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: theme.palette.line,
                    backgroundColor: theme.palette.paper,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="filter" size={18} color="ink" />
                  {filtered ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 5,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: theme.palette.canvas,
                        backgroundColor: theme.palette.solid,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppText
                        variant="numeric"
                        color="onSolid"
                        maxScale={1.2}
                        style={{ fontSize: 11, lineHeight: 14 }}
                      >
                        {String(props.filter.length)}
                      </AppText>
                    </View>
                  ) : null}
                </Pressable>
              )}
            </View>
          </View>
          {/*
            What the journal is narrowed to, under the title, each with its
            own X, and a reset for all of them: letting the filter go is
            one tap here, not a trip into the sheet (owner's word, 2026-10-13).
          */}
          {filtered ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {props.filter.map((id) => (
                <Chip
                  key={id}
                  label={emotionLabel(id, t)}
                  color={theme.palette.tag}
                  action="remove"
                  onPress={() => {
                    props.onFilter(props.filter.filter((each) => each !== id));
                  }}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  props.onFilter([]);
                }}
                style={{ paddingHorizontal: 6 }}
              >
                <AppText variant="label" color="inkSoft">
                  {t('feed.filterReset')}
                </AppText>
              </Pressable>
            </View>
          ) : null}
          </View>
        }
        ListEmptyComponent={
          props.days === null ? null : filtered ? (
            <AppText variant="body" color="inkSoft" style={{ paddingVertical: 24 }}>
              {t('feed.filterNothing')}
            </AppText>
          ) : (
            <View style={{ alignItems: 'center', gap: 18, paddingVertical: 64, paddingHorizontal: 12 }}>
              {/* The mark itself, quiet: the screen is empty and should look it. */}
              <View style={{ opacity: 0.3 }}>
                <WaveMark width={156} color={theme.palette.ink} echoColor={theme.palette.ink} />
              </View>
              <AppText variant="kicker">{t('feed.emptyTitle')}</AppText>
              <AppText variant="body" color="inkSoft" align="center" style={{ maxWidth: 250 }}>
                {t('feed.emptyBody')}
              </AppText>
              <Button label={t('feed.record')} onPress={props.onRecord} />
            </View>
          )
        }
      />
      <EmotionFilterSheet
        open={filtering}
        emotionIds={offered}
        chosen={props.filter}
        t={t}
        onApply={(emotionIds) => {
          setFiltering(false);
          props.onFilter(emotionIds);
        }}
        onClose={() => {
          setFiltering(false);
        }}
      />
    </View>
  );
}

function keyOf(row: Row): string {
  return row.kind === 'entry' ? row.entry.id : `milestone-${row.milestone.id}`;
}

/** The drawing's 12pt between cards, as a separator rather than a gap the list cannot see. */
function Gap(): React.JSX.Element {
  return <View style={{ height: 12 }} />;
}

/** The month the journal reaches back to, which is what the summary is about. */
type Row =
  | { readonly kind: 'entry'; readonly entry: MoodEntry; readonly at: number }
  | { readonly kind: 'milestone'; readonly milestone: Milestone; readonly at: number };

/**
 * Entries and milestones on one line, newest first. A milestone sorts just
 * below the last entry of its day, so reading down the page it separates
 * that day's entries from the ones before it — after above, before below.
 */
function interleave(entries: readonly MoodEntry[], milestones: readonly Milestone[]): readonly Row[] {
  const rows: Row[] = [
    ...entries.map((entry): Row => ({ kind: 'entry', entry, at: entry.createdAt.getTime() })),
    ...milestones.map((milestone): Row => ({ kind: 'milestone', milestone, at: milestone.day.getTime() - 1 })),
  ];

  return rows.sort((a, b) => b.at - a.at);
}
