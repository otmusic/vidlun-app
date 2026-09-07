import { useState } from 'react';
import { Keyboard, Pressable, TextInput, useWindowDimensions } from 'react-native';

import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Sheet } from './Sheet';

/**
 * The drawing's feedback sheet: a note to whoever makes the app, typed as
 * is and sent as is. The sheet closes on the tap — the note is handed to an
 * outbox that mails it in the background and tries again later if it could
 * not — so nothing here ever waits on the network.
 */
export function FeedbackSheet(props: {
  readonly open: boolean;
  readonly t: Translate;
  /** Takes the note; resolves once it is kept, not once it is mailed. */
  readonly onSend: (text: string) => Promise<void>;
  readonly onClose: () => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = props;
  const [text, setText] = useState('');
  const ready = text.trim().length > 0;

  const close = (): void => {
    Keyboard.dismiss();
    setText('');
    props.onClose();
  };

  const send = (): void => {
    if (!ready) {
      return;
    }

    void props.onSend(text.trim());
    close();
  };

  return (
    <Sheet open={props.open} closeLabel={t('feedback.cancel')} onClose={close}>
      <AppText variant="display" style={{ fontSize: 22, lineHeight: 28 }}>
        {t('feedback.title')}
      </AppText>
      <AppText variant="secondary" color="inkSoft" style={{ fontSize: 14.5, lineHeight: 22 }}>
        {t('feedback.body')}
      </AppText>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('feedback.placeholder')}
        placeholderTextColor={theme.palette.inkFaint}
        multiline
        style={{
          ...theme.type.quote,
          // Five lines, or three on a phone too short for five and a keyboard.
          minHeight: (windowHeight < 720 ? 3 : 5) * 24,
          color: theme.palette.ink,
          backgroundColor: theme.palette.canvas,
          borderWidth: 1,
          borderColor: theme.palette.line,
          borderRadius: 20,
          paddingVertical: 16,
          paddingHorizontal: 18,
          textAlignVertical: 'top',
        }}
      />
      <AppText
        variant="caption"
        color="inkFaint"
        style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, lineHeight: 19 }}
      >
        {t('feedback.note')}
      </AppText>
      {/*
        * The drawing greys the button rather than hiding it while the field
        * is empty: the way forward stays visible, it just is not open yet.
        */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        onPress={send}
        style={{
          marginTop: 4,
          borderRadius: 999,
          backgroundColor: ready ? theme.palette.solid : theme.palette.line,
          paddingVertical: 16,
          alignItems: 'center',
        }}
      >
        <AppText variant="body" style={{ color: ready ? theme.palette.onSolid : theme.palette.inkFaint }}>
          {t('feedback.send')}
        </AppText>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={close} style={{ paddingVertical: 10, alignItems: 'center' }}>
        <AppText variant="secondary" color="inkFaint">
          {t('feedback.cancel')}
        </AppText>
      </Pressable>
    </Sheet>
  );
}
