import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

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

/**
 * The journal's filter (owner's word, 2026-10-13; topics 2026-11-24, canvas
 * variant A): every emotion this person has used, and under them every
 * topic their entries had, as chips to pick, and "Show" to narrow the
 * journal to them. Nothing changes until that button: closing the sheet
 * leaves the journal as it was. "Show" waits for a chip (owner's word,
 * 2026-11-24); the whole journal comes back through "Reset" on the journal
 * itself.
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

  // Every opening starts from what is applied, not from a choice left unshown.
  useEffect(() => {
    if (props.open) {
      setPicked(props.chosen);
    }
  }, [props.open, props.chosen]);

  const toggle = (group: keyof JournalFilter, word: string): void => {
    setPicked((current) => {
      const words = current[group];

      return {
        ...current,
        [group]: words.includes(word) ? words.filter((each) => each !== word) : [...words, word],
      };
    });
  };

  return (
    <ModalSheet open={props.open} closeLabel={t('common.close')} onClose={props.onClose}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <AppText variant="caption" color="inkFaint" style={{ flexShrink: 1 }}>
          {t('feed.filterTitle')}
        </AppText>
        <SheetClose label={t('common.close')} onPress={props.onClose} />
      </View>

      {/*
        * Most of the screen at most (owner's word, 2026-11-24: half was too
        * little once topics joined the emotions); a long journal scrolls its
        * words, not the sheet.
        */}
      <ScrollView style={{ maxHeight: height * WORDS_SHARE }} contentContainerStyle={{ gap: 20 }}>
        {props.emotionIds.length === 0 ? null : (
          <View style={{ gap: 10 }}>
            <AppText variant="caption" color="inkFaint" style={{ fontSize: 12 }}>
              {t('entry.emotions')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {props.emotionIds.map((id) => (
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
              ))}
            </View>
          </View>
        )}
        {props.topics.length === 0 ? null : (
          <View style={{ gap: 10 }}>
            <AppText variant="caption" color="inkFaint" style={{ fontSize: 12 }}>
              {t('entry.topics')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {props.topics.map((tag) => (
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
          </View>
        )}
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
