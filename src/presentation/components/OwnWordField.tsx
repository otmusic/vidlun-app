import { Pressable, TextInput } from 'react-native';

import { OWN_WORD_MAX_LENGTH } from '@/domain/entities/OwnWord';
import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

/**
 * The way to name a feeling the palette does not have (owner's word,
 * 2026-09-30): a dashed pill that opens into one line for a word of the
 * person's own. Drawn in place, never in a Modal — a sheet with a text field
 * eats the first tap on iOS 26 while the keyboard is up.
 *
 * Controlled from the card, so a word still being typed when the person taps
 * "next" is not lost: the card commits it first.
 */
export function OwnWordField(props: {
  /** Null while closed; the word so far while open. */
  readonly typing: string | null;
  readonly t: Translate;
  readonly onOpen: () => void;
  readonly onChange: (text: string) => void;
  /** Return pressed, or the field left with something in it. */
  readonly onCommit: () => void;
  /** The field left empty. */
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  if (props.typing === null) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={props.onOpen}
        hitSlop={8}
        style={{
          alignSelf: 'flex-start',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: theme.palette.line,
          borderRadius: 999,
          paddingVertical: 9,
          paddingHorizontal: 16,
        }}
      >
        <AppText variant="secondary" color="inkSoft">
          {`+ ${props.t('turn.ownWord')}`}
        </AppText>
      </Pressable>
    );
  }

  return (
    <TextInput
      value={props.typing}
      onChangeText={props.onChange}
      autoFocus
      maxLength={OWN_WORD_MAX_LENGTH}
      returnKeyType="done"
      onSubmitEditing={props.onCommit}
      onBlur={() => {
        if ((props.typing ?? '').trim().length === 0) {
          props.onClose();
        } else {
          props.onCommit();
        }
      }}
      accessibilityLabel={props.t('turn.ownWord')}
      style={{
        ...theme.type.body,
        // A line of its own inside the row of chosen words.
        width: '100%',
        color: theme.palette.ink,
        backgroundColor: theme.palette.paper,
        borderWidth: 1.5,
        borderColor: theme.palette.ink,
        borderRadius: 999,
        paddingVertical: 11,
        paddingHorizontal: 18,
      }}
    />
  );
}
