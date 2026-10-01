import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { BackButton } from '../components/BackButton';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/** The fallback for a room where you cannot speak. Same path, same card. */
export function TextEntryScreen(props: {
  readonly t: Translate;
  readonly onSubmit: (text: string) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [text, setText] = useState('');

  return (
    <Screen>
      {/*
       * §7.3 puts the primary action in the thumb zone, which on a focused text
       * screen is exactly where the keyboard appears. Without this the send
       * button sits underneath it and the entry cannot be finished at all.
       */}
      <KeyboardAvoidingView
        style={{ flex: 1, gap: theme.spacing.sm }}
        behavior={Platform.select({ ios: 'padding', default: undefined })}
      >
        {/* The way out is the arrow, top left, not a "cancel" under the button (owner's word, 2026-10-01). */}
        <BackButton t={props.t} onPress={props.onBack} />
        <AppText variant="display">{props.t('text.title')}</AppText>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={props.t('text.placeholder')}
          placeholderTextColor={theme.palette.inkFaint}
          multiline
          autoFocus
          style={{
            ...theme.type.body,
            color: theme.palette.ink,
            backgroundColor: theme.palette.paper,
            borderRadius: theme.radii.card,
            borderWidth: 1,
            borderColor: theme.palette.line,
            padding: theme.spacing.md,
            marginTop: theme.spacing.md,
            minHeight: 120,
          }}
        />
        {/*
         * A multiline field takes Return as a new line, so there is no way to
         * put the keyboard away from the keyboard itself. The empty space above
         * the buttons becomes that way out.
         */}
        <Pressable
          style={{ flex: 1 }}
          onPress={Keyboard.dismiss}
          accessible={false}
          importantForAccessibility="no"
        />
        <Button
          label={props.t('text.send')}
          onPress={() => {
            props.onSubmit(text);
          }}
          disabled={text.trim().length === 0}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
