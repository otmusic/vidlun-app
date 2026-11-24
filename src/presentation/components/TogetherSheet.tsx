import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { emotionLabel } from './emotionDisplay';
import { ModalSheet, SheetClose } from './ModalSheet';

/**
 * Choosing together, as a sheet over the card's feelings step rather than a
 * page of its own (owner's word, 2026-11-24): the words Vidlun heard, all
 * chosen to start with, and "Choose" to put the ones left chosen on the card.
 * A tap takes a word off and the same tap puts it back, so agreeing costs
 * nothing and disagreeing is one tap per word. Closing it adds nothing.
 */
export function TogetherSheet(props: {
  readonly open: boolean;
  /** Vidlun's words, as it heard them. */
  readonly heard: readonly string[];
  /** The words in the language the entry was said in. */
  readonly words: Translate;
  readonly t: Translate;
  readonly onChoose: (ids: readonly string[]) => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  const [picked, setPicked] = useState<readonly string[]>(props.heard);

  // Every opening starts from all of Vidlun's words, as the drawing has it.
  useEffect(() => {
    if (props.open) {
      setPicked(props.heard);
    }
  }, [props.open, props.heard]);

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
          <Sparkle colour={theme.palette.accentInk} size={13} />
          <AppText variant="caption" color="accentInk">
            {t('compare.luna')}
          </AppText>
        </View>
        <SheetClose label={t('common.close')} onPress={props.onClose} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {props.heard.map((id) => {
          const on = picked.includes(id);

          return (
            <Chip
              key={id}
              label={emotionLabel(id, props.words)}
              color={theme.palette.tag}
              selected={on}
              action={on ? 'remove' : 'add'}
              onPress={() => {
                toggle(id);
              }}
            />
          );
        })}
      </View>

      <Button
        label={t('card.takeTogether')}
        disabled={picked.length === 0}
        style={{ marginTop: 24 }}
        onPress={() => {
          props.onChoose(picked);
        }}
      />
    </ModalSheet>
  );
}

/** Vidlun's mark, beside what Vidlun heard and on the way to it. */
export function Sparkle(props: { readonly colour: string; readonly size: number }): React.JSX.Element {
  return (
    <Svg viewBox="0 0 24 24" width={props.size} height={props.size}>
      <Path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" fill={props.colour} />
    </Svg>
  );
}
