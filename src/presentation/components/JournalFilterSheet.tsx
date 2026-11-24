import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import type { Translate } from '@/i18n';

import type { JournalFilter } from '../screens/journalFilter';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { emotionLabel } from './emotionDisplay';
import { ModalSheet, SheetClose } from './ModalSheet';

/** How much of the screen the words may take before they scroll; the title and the button sit around them. */
const WORDS_SHARE = 0.7;

type Tab = keyof JournalFilter;

/**
 * The journal's filter (owner's word, 2026-10-13; topics 2026-11-24): every
 * emotion this person has used and every topic their entries had, as chips
 * to pick, and "Show" to narrow the journal to them. Nothing changes until
 * that button: closing the sheet leaves the journal as it was. "Show" waits
 * for a chip (owner's word, 2026-11-24); the whole journal comes back
 * through "Reset" on the journal itself.
 *
 * The emotions and the topics are two tabs (owner's word, 2026-11-24,
 * canvas variant B): with many emotions the topics sat out of sight at the
 * bottom of the sheet. Each tab's name carries how many of its words are
 * picked, so a choice on the other tab is never lost from view, and the
 * sheet keeps the taller tab's height, so switching does not make it jump.
 */
export function JournalFilterSheet(props: {
  readonly open: boolean;
  /** The emotions on offer, the most used first. */
  readonly emotionIds: readonly string[];
  /** The topics on offer, the most used first. */
  readonly topics: readonly string[];
  /** What the journal is narrowed to now; the sheet opens with these picked. */
  readonly chosen: JournalFilter;
  readonly t: Translate;
  readonly onApply: (filter: JournalFilter) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const { t } = props;
  const [picked, setPicked] = useState<JournalFilter>(props.chosen);
  const [tab, setTab] = useState<Tab>('emotionIds');
  /** Each tab's words, measured, so the sheet can hold the taller one's height. */
  const [heights, setHeights] = useState<Readonly<Record<Tab, number>>>({ emotionIds: 0, topics: 0 });
  // Tabs only when there is something on both; otherwise the one list is the sheet.
  const tabbed = props.emotionIds.length > 0 && props.topics.length > 0;
  const shown: Tab = !tabbed ? (props.emotionIds.length > 0 ? 'emotionIds' : 'topics') : tab;

  // Every opening starts from what is applied, on the tab that holds it.
  useEffect(() => {
    if (props.open) {
      setPicked(props.chosen);
      setTab(props.chosen.emotionIds.length === 0 && props.chosen.topics.length > 0 ? 'topics' : 'emotionIds');
    }
  }, [props.open, props.chosen]);

  const toggle = (group: Tab, word: string): void => {
    setPicked((current) => {
      const words = current[group];

      return {
        ...current,
        [group]: words.includes(word) ? words.filter((each) => each !== word) : [...words, word],
      };
    });
  };

  const measured = (group: Tab) => (event: { readonly nativeEvent: { readonly layout: { readonly height: number } } }) => {
    const next = event.nativeEvent.layout.height;

    setHeights((current) => (current[group] === next ? current : { ...current, [group]: next }));
  };

  const words = (group: Tab): React.JSX.Element => (
    <View
      onLayout={measured(group)}
      pointerEvents={shown === group ? 'auto' : 'none'}
      accessibilityElementsHidden={shown !== group}
      importantForAccessibility={shown === group ? 'auto' : 'no-hide-descendants'}
      // The tab not shown is laid out out of sight, only to be measured.
      style={[
        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        shown === group ? null : { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
      ]}
    >
      {group === 'emotionIds'
        ? props.emotionIds.map((id) => (
            <Chip
              key={id}
              label={emotionLabel(id, t)}
              color={theme.palette.tag}
              selected={picked.emotionIds.includes(id)}
              action="add"
              onPress={() => {
                toggle('emotionIds', id);
              }}
            />
          ))
        : props.topics.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              tone="neutral"
              selected={picked.topics.includes(tag)}
              action="add"
              onPress={() => {
                toggle('topics', tag);
              }}
            />
          ))}
    </View>
  );

  return (
    <ModalSheet open={props.open} closeLabel={t('common.close')} onClose={props.onClose}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: tabbed ? 14 : 18,
        }}
      >
        <AppText variant="caption" color="inkFaint" style={{ flexShrink: 1 }}>
          {t('feed.filterTitle')}
        </AppText>
        <SheetClose label={t('common.close')} onPress={props.onClose} />
      </View>

      {!tabbed ? null : (
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            gap: 24,
            borderBottomWidth: 1,
            borderBottomColor: theme.palette.line,
            marginBottom: 18,
          }}
        >
          <FilterTab
            label={t('entry.emotions')}
            count={picked.emotionIds.length}
            active={tab === 'emotionIds'}
            onPress={() => {
              setTab('emotionIds');
            }}
          />
          <FilterTab
            label={t('entry.topics')}
            count={picked.topics.length}
            active={tab === 'topics'}
            onPress={() => {
              setTab('topics');
            }}
          />
        </View>
      )}

      {/*
        * Most of the screen at most (owner's word, 2026-11-24: half was too
        * little); a long journal scrolls its words, not the sheet.
        */}
      <ScrollView style={{ maxHeight: height * WORDS_SHARE }}>
        <View style={{ minHeight: tabbed ? Math.max(heights.emotionIds, heights.topics) : 0 }}>
          {props.emotionIds.length === 0 ? null : words('emotionIds')}
          {props.topics.length === 0 ? null : words('topics')}
        </View>
      </ScrollView>

      {/* No "reset" beside it (owner's word, 2026-10-13): a picked chip lets go on a second tap. */}
      <Button
        label={t('feed.filterShow')}
        disabled={picked.emotionIds.length === 0 && picked.topics.length === 0}
        style={{ marginTop: 24 }}
        onPress={() => {
          props.onApply(picked);
        }}
      />
    </ModalSheet>
  );
}

/** A tab's name, underlined while open, with how many of its words are picked in a small round count. */
function FilterTab(props: {
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: props.active }}
      accessibilityLabel={props.count === 0 ? props.label : `${props.label}, ${String(props.count)}`}
      onPress={props.onPress}
      hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 2,
        paddingBottom: 10,
        marginBottom: -1,
        borderBottomWidth: 2,
        borderBottomColor: props.active ? theme.palette.ink : 'transparent',
      }}
    >
      <AppText
        variant={props.active ? 'label' : 'body'}
        color={props.active ? 'ink' : 'inkSoft'}
        style={{ fontSize: 16 }}
      >
        {props.label}
      </AppText>
      {props.count === 0 ? null : (
        <View
          style={{
            minWidth: 20,
            height: 20,
            paddingHorizontal: 5,
            borderRadius: 10,
            backgroundColor: props.active ? theme.palette.solid : theme.palette.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="numeric"
            color={props.active ? 'onSolid' : 'ink'}
            maxScale={1.2}
            style={{ fontSize: 12, lineHeight: 14 }}
          >
            {String(props.count)}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
