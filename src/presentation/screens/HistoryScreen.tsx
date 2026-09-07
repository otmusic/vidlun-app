import { Pressable, ScrollView, View } from 'react-native';

import type { HistoryDay } from '@/application/use-cases/GetHistory';
import type { Milestone } from '@/domain/entities/Milestone';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import type { Locale, Translate } from '@/i18n';
import { countedKey } from '@/i18n/plural';

import { AppText } from '../components/AppText';
import { EntryCard } from '../components/EntryCard';
import { Button } from '../components/Button';
import { WaveMark } from '../components/WaveMark';
import { useTheme } from '../theme/ThemeProvider';

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
  const { t } = props;
  const entries = (props.days ?? []).flatMap((day) => day.entries);
  const rows = interleave(entries, props.milestones);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.palette.canvas }}
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 22, paddingBottom: BOTTOM_ROOM }}
    >
      <AppText variant="display" style={{ marginBottom: 6 }}>
        {t('feed.title')}
      </AppText>
      <AppText variant="secondary" color="inkSoft" style={{ marginBottom: 26 }}>
        {entries.length === 0
          ? t('feed.noneYet')
          : t('feed.summary', {
              n: entries.length,
              unit: t(countedKey('feed.echo', entries.length, props.locale)),
              period: periodOf(entries, props.locale),
            })}
      </AppText>

      {props.days === null ? null : entries.length === 0 ? (
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
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((row) =>
            row.kind === 'entry' ? (
              <EntryCard
                key={row.entry.id}
                entry={row.entry}
                vocabulary={props.vocabulary}
                locale={props.locale}
                today={props.today}
                t={t}
                showEmotions
                onOpen={() => {
                  props.onOpen(row.entry);
                }}
              />
            ) : (
              /* The drawing's rule with the milestone's name in it: the
                 entries above came after, the ones below came before. */
              <Pressable
                key={`milestone-${row.milestone.id}`}
                accessibilityRole="button"
                onPress={() => {
                  props.onEditMilestone(row.milestone);
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
          )}
        </View>
      )}
    </ScrollView>
  );
}

/** The month the journal reaches back to, which is what the summary is about. */
function periodOf(entries: readonly MoodEntry[], locale: Locale): string {
  const oldest = entries[entries.length - 1];

  return oldest === undefined
    ? ''
    : oldest.createdAt.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

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
