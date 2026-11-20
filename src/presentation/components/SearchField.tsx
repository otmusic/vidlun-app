import { useRef, useState } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The journal's search, the canvas's variant A (owner's word, 2026-11-20): a
 * field under the title that scrolls with the list. The list narrows as the
 * words are typed — no button to press — and "Cancel", there while the field
 * is in use, empties it and puts the keyboard away.
 */
export function SearchField(props: {
  readonly value: string;
  readonly onChange: (typed: string) => void;
  readonly t: Translate;
}): React.JSX.Element {
  const theme = useTheme();
  const field = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const inUse = focused || props.value.length > 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          flex: 1,
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: focused ? theme.palette.ink : theme.palette.line,
          backgroundColor: theme.palette.paper,
          paddingLeft: 14,
          paddingRight: props.value.length > 0 ? 4 : 14,
        }}
      >
        <Icon name="search" size={18} color="inkFaint" />
        <TextInput
          ref={field}
          value={props.value}
          onChangeText={props.onChange}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          placeholder={props.t('search.placeholder')}
          placeholderTextColor={theme.palette.inkFaint}
          accessibilityLabel={props.t('search.placeholder')}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="never"
          selectionColor={theme.palette.accent}
          style={{ ...theme.type.body, flex: 1, fontSize: 16, color: theme.palette.ink, paddingVertical: 10 }}
        />
        {props.value.length === 0 ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.t('search.clear')}
            hitSlop={6}
            onPress={() => {
              props.onChange('');
              field.current?.focus();
            }}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="x-circle" size={18} color="inkFaint" />
          </Pressable>
        )}
      </View>
      {inUse ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            props.onChange('');
            Keyboard.dismiss();
          }}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <AppText variant="body" color="ink">
            {props.t('search.cancel')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
