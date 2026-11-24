import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View, type ListRenderItem } from 'react-native';

import type { HistoryDay } from '@/application/use-cases/GetHistory';
import { entriesOpen } from '@/domain/entities/Entitlement';
import type { Milestone } from '@/domain/entities/Milestone';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { SearchQuery } from '@/domain/value-objects/SearchQuery';
import type { Locale, Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { CountPill } from '../components/CountPill';
import { JournalFilterSheet } from '../components/JournalFilterSheet';
import { EntryCard } from '../components/EntryCard';
import { EntryRow, SwipeGroup } from '../components/EntryRow';
import { SearchField } from '../components/SearchField';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { WaveMark } from '../components/WaveMark';
import { emotionLabel } from '../components/emotionDisplay';
import { useDrawnSides } from '../hooks/useDrawnSides';
import { useDrawnTop } from '../hooks/useDrawnTop';
import { useTheme } from '../theme/ThemeProvider';
import {
  emotionsUsed,
  entriesMatching,
  filterSize,
  NO_FILTER,
  topicsUsed,
  type JournalFilter,
  type JournalFocus,
} from './journalFilter';

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
  /** The emotions and topics the journal is narrowed to; empty shows every entry. */
  readonly filter: JournalFilter;
  /**
   * What is typed into the search (owner's word, 2026-11-20); empty shows
   * every entry. It narrows whatever the filter left.
   */
  readonly query: string;
  readonly onQuery: (typed: string) => void;
  readonly onFilter: (filter: JournalFilter) => void;
  /** A topic tapped on a card: the journal narrowed to it (owner's word, 2026-11-24). */
  readonly onOpenTopic: (topic: string) => void;
  /** A pattern's days, opened from the stats screen; null shows the journal. */
  readonly focus: JournalFocus | null;
  readonly onClearFocus: () => void;
  readonly vocabulary: EmotionVocabulary;
  readonly locale: Locale;
  readonly today: Date;
  readonly t: Translate;
  /** `found` is the search the entry was found by, so its page can light the word. */
  readonly onOpen: (entry: MoodEntry, found?: string) => void;
  /**
   * Whether every entry reads, with a subscription or its free trial. Without
   * one only the newest does (owner's word, 2026-11-17); every other entry
   * is still its own card — day, time, mood colour, a small lock and one
   * faint line — whose tap opens the subscription and which a swipe or a
   * hold deletes, since it cannot be opened to be deleted from there.
   */
  readonly readsAll: boolean;
  readonly onOpenSubscription: () => void;
  readonly onDelete: (id: string) => void;
  readonly onRecord: () => void;
  /** Every milestone; each sits as a rule between the days before and after it. */
  readonly milestones: readonly Milestone[];
  readonly onEditMilestone: (milestone: Milestone) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const top = useDrawnTop(70);
  const sides = useDrawnSides();
  const { t, onOpen, onOpenSubscription, onDelete, onEditMilestone } = props;
  const [filtering, setFiltering] = useState(false);
  const entries = useMemo(() => (props.days ?? []).flatMap((day) => day.entries), [props.days]);
  const offered = useMemo(() => emotionsUsed(entries), [entries]);
  const topics = useMemo(() => topicsUsed(entries), [entries]);
  const { focus, filter } = props;
  const chosen = filterSize(filter);
  const filtered = chosen > 0;
  const search = useMemo(() => SearchQuery.of(props.query), [props.query]);
  const narrowed = filtered || focus !== null || search !== null;
  const shown = useMemo(() => {
    const wanted = focus === null ? null : new Set(focus.entryIds);
    const kept =
      wanted === null ? entriesMatching(entries, filter) : entries.filter((entry) => wanted.has(entry.id));

    /*
     * In what was said. A locked entry is found like any other and stays
     * locked: its date and its lock, never its words (owner's word,
     * 2026-11-20).
     */
    return search === null ? kept : kept.filter((entry) => search.matches(entry.cleanTranscript));
  }, [entries, filter, focus, search]);
  // Sorted once per journal, not once per frame: a year of entries is a
  // few hundred rows, and the list re-renders on every scroll tick. The
  // milestones step aside while the journal is filtered: between a few
  // chosen days they would stand next to each other with nothing between.
  const rows = useMemo(
    () => interleave(shown, narrowed ? [] : props.milestones),
    [shown, narrowed, props.milestones],
  );
  // Counted over the whole journal, so a filter never opens an older entry.
  const open = useMemo(() => entriesOpen(entries, props.readsAll), [entries, props.readsAll]);
  const lockedHint = t('subs.entryLocked');

  const renderRow = useCallback<ListRenderItem<Row>>(
    ({ item: row }) =>
      row.kind === 'entry' && open !== null && !open.has(row.entry.id) ? (
        <EntryRow
          entry={row.entry}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          t={t}
          onOpen={onOpenSubscription}
          onDelete={onDelete}
          lockedHint={lockedHint}
        />
      ) : row.kind === 'entry' ? (
        <EntryCard
          entry={row.entry}
          vocabulary={props.vocabulary}
          locale={props.locale}
          today={props.today}
          t={t}
          hasAudio={props.recorded?.has(row.entry.id)}
          found={search}
          onOpen={() => {
            onOpen(row.entry, search === null ? undefined : props.query);
          }}
          onTopic={props.onOpenTopic}
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
      lockedHint,
      onDelete,
      onEditMilestone,
      onOpen,
      onOpenSubscription,
      open,
      props.locale,
      props.onOpenTopic,
      props.query,
      props.recorded,
      props.today,
      props.vocabulary,
      search,
      t,
      theme.palette.ink,
    ],
  );

  return (
    // One swiped-open locked card at a time, as on home.
    <SwipeGroup>
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
          {/*
            The gap is only the least the title and the pill may stand apart:
            spread to the edges, they are further apart than that on any
            phone. Kept at 8 so a three-digit count stays beside the title
            on a 390pt phone (owner's word, 2026-11-20, on a 14 Pro).
          */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              columnGap: 8,
              rowGap: 12,
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
                emotions and topics it holds, so a short journal never looks
                like a lost one.
              */}
              {offered.length === 0 && topics.length === 0 ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('feed.filter')}
                  accessibilityState={{ selected: filtered }}
                  accessibilityValue={filtered ? { text: String(chosen) } : undefined}
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
                        {String(chosen)}
                      </AppText>
                    </View>
                  ) : null}
                </Pressable>
              )}
            </View>
          </View>
          {/*
            The search under the title (owner's word, 2026-11-20), absent
            while there is nothing to search.
          */}
          {entries.length === 0 ? null : <SearchField value={props.query} onChange={props.onQuery} t={t} />}
          {/*
            What the journal is narrowed to, under the title, each with its
            own X, and a reset for all of them: letting the filter go is
            one tap here, not a trip into the sheet (owner's word, 2026-10-13).
          */}
          {/* A pattern's days: one chip naming them, and its X back to the whole journal. */}
          {focus === null ? null : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip
                label={focus.label}
                color={theme.palette.tag}
                action="remove"
                onPress={props.onClearFocus}
              />
            </View>
          )}
          {filtered ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {filter.emotionIds.map((id) => (
                <Chip
                  key={id}
                  label={emotionLabel(id, t)}
                  color={theme.palette.tag}
                  action="remove"
                  onPress={() => {
                    props.onFilter({ ...filter, emotionIds: filter.emotionIds.filter((each) => each !== id) });
                  }}
                />
              ))}
              {/* Topics after the emotions, in their own grey (owner's word, 2026-11-24). */}
              {filter.topics.map((tag) => (
                <Chip
                  key={`topic:${tag}`}
                  label={tag}
                  tone="neutral"
                  action="remove"
                  onPress={() => {
                    props.onFilter({ ...filter, topics: filter.topics.filter((each) => each !== tag) });
                  }}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  props.onFilter(NO_FILTER);
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
          props.days === null ? null : search !== null ? (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 20 }}>
              <AppText variant="kicker" align="center">
                {t('search.nothingTitle')}
              </AppText>
              <AppText variant="body" color="inkSoft" align="center">
                {t('search.nothingBody')}
              </AppText>
            </View>
          ) : narrowed ? (
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
      <JournalFilterSheet
        open={filtering}
        emotionIds={offered}
        topics={topics}
        chosen={filter}
        t={t}
        onApply={(picked) => {
          setFiltering(false);
          props.onFilter(picked);
        }}
        onClose={() => {
          setFiltering(false);
        }}
      />
    </View>
    </SwipeGroup>
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
