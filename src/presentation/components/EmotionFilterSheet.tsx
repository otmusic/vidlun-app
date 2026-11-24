import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { emotionLabel } from './emotionDisplay';
import { ModalSheet, SheetClose } from './ModalSheet';

/**
 * The journal's filter (owner's word, 2026-10-13): every emotion this person
 * has used, as chips to pick, and "Show" to narrow the journal to the
 * entries holding any of them. Nothing changes until that button: closing the
 * sheet leaves the journal as it was. "Show" waits for a chip (owner's word,
 * 2026-11-24); the whole journal comes back through "Reset" on the journal
 * itself.
 */
export function EmotionFilterSheet(props: {
  readonly open: boolean;
  /** The emotions on offer, the most used first. */
  readonly emotionIds: readonly string[];
  /** What the journal is narrowed to now; the sheet opens with these picked. */
  readonly chosen: readonly string[];
  readonly t: Translate;
  readonly onApply: (emotionIds: readonly string[]) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const { t } = props;
  const [picked, setPicked] = useState<readonly string[]>(props.chosen);

  // Every opening starts from what is applied, not from a choice left unshown.
  useEffect(() => {
    if (props.open) {
      setPicked(props.chosen);
    }
  }, [props.open, props.chosen]);

  const toggle = (id: string): void => {
    setPicked((current) =>
      current.includes(id) ? current.filter((each) => each !== id) : [...current, id],
    );
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

      {/* Half the screen at most; a long journal scrolls its words, not the sheet. */}
      <ScrollView style={{ maxHeight: height * 0.5 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {props.emotionIds.map((id) => (
            <Chip
              key={id}
              label={emotionLabel(id, t)}
              color={theme.palette.tag}
              selected={picked.includes(id)}
              action="add"
              onPress={() => {
                toggle(id);
              }}
            />
          ))}
        </View>
      </ScrollView>

      {/* No "reset" beside it (owner's word, 2026-10-13): a picked chip lets go on a second tap. */}
      <Button
        label={t('feed.filterShow')}
        disabled={picked.length === 0}
        style={{ marginTop: 24 }}
        onPress={() => {
          props.onApply(picked);
        }}
      />
    </ModalSheet>
  );
}
