import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * The dashed "+ …" pill at the end of a row of chips: the way to write one
 * in, a topic or an emotion of the person's own.
 */
export function AddPill(props: { readonly label: string; readonly onPress: () => void }): React.JSX.Element {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={props.onPress}
      style={{
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: theme.palette.lineStrong,
        borderRadius: theme.radii.pill,
        paddingVertical: 6,
        paddingHorizontal: 13,
      }}
    >
      <AppText variant="secondary" color="inkSoft">
        {`+ ${props.label}`}
      </AppText>
    </Pressable>
  );
}

/**
 * What the dashed pill becomes once tapped: a chip of the row's own size,
 * typed into where the word will stand, with its own round tick, pale until
 * something is typed (owner's pick, 2026-11-23). In place, never in a Modal:
 * a sheet with a text field eats the first tap on iOS 26 while the keyboard
 * is up. The tick, return, and leaving the field all commit; the caller
 * decides what an empty commit means.
 */
export function ChipField(props: {
  readonly value: string;
  readonly placeholder: string;
  /** What the field and its tick say to VoiceOver. */
  readonly label: string;
  readonly maxLength: number;
  /** Topics stay in lower case, as Vidlun writes them; a feeling starts as a sentence does. */
  readonly autoCapitalize: 'none' | 'sentences';
  readonly onChange: (text: string) => void;
  readonly onCommit: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const ready = props.value.trim().length > 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 150,
        maxWidth: '100%',
        borderWidth: 1.5,
        borderColor: theme.palette.ink,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.paper,
        paddingVertical: 3.5,
        paddingLeft: 13,
        paddingRight: 4,
      }}
    >
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        autoFocus
        maxLength={props.maxLength}
        autoCapitalize={props.autoCapitalize}
        returnKeyType="done"
        onSubmitEditing={props.onCommit}
        onBlur={props.onCommit}
        placeholder={props.placeholder}
        placeholderTextColor={theme.palette.inkFaint}
        accessibilityLabel={props.label}
        style={{
          ...theme.type.secondary,
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 90,
          paddingVertical: 0,
          color: theme.palette.ink,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label}
        hitSlop={10}
        onPress={props.onCommit}
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ready ? theme.palette.ink : theme.palette.lineStrong,
        }}
      >
        <Icon name="check" size={14} color="onSolid" />
      </Pressable>
    </View>
  );
}
