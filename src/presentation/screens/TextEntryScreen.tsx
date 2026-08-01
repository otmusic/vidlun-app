import { useState } from 'react';
import { TextInput, View } from 'react-native';

import type { Translate } from '@/i18n';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/** The fallback for a room where you cannot speak. Same path, same card. */
export function TextEntryScreen(props: {
  readonly t: Translate;
  readonly onSubmit: (text: string) => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [text, setText] = useState('');

  return (
    <Screen>
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
      <View style={{ flex: 1 }} />
      <Button
        label={props.t('text.send')}
        onPress={() => {
          props.onSubmit(text);
        }}
        disabled={text.trim().length === 0}
      />
      <Button label={props.t('common.cancel')} variant="ghost" onPress={props.onCancel} />
    </Screen>
  );
}
