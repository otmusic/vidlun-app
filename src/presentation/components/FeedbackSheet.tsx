import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

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
}): React.JSX.Element {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = props;
  const [text, setText] = useState('');
  const ready = text.trim().length > 0;

  const close = (): void => {
    setText('');
    props.onClose();
  };

  const send = (): void => {
    if (!ready) {
      return;
    }

    void props.onSend(text.trim());
    Keyboard.dismiss();
    close();
  };

  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('feedback.cancel')}
          onPress={close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,12,16,0.42)' }}
        />
        {/*
          * The keyboard rises over a sheet pinned to the bottom, so the sheet
          * rises with it: "Send" under the keys is a note that cannot be
          * sent. Taps always reach the buttons — the scroll view is not
          * allowed to spend the first one on putting the keyboard away, which
          * made "Send" a two-tap button — and the keyboard goes with a drag
          * down over the sheet, or with the sheet itself.
          */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' }}
        >
          <View
            style={{
              backgroundColor: theme.palette.paper,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
            }}
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="interactive"
              style={{ maxHeight: windowHeight - 80 }}
              contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 30 }}
            >
              <View style={{ gap: 12 }}>
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
                    minHeight: 5 * 24,
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
                  * The drawing greys the button rather than hiding it while
                  * the field is empty: the way forward stays visible, it
                  * just is not open yet.
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
                  <AppText
                    variant="body"
                    style={{ color: ready ? theme.palette.onSolid : theme.palette.inkFaint }}
                  >
                    {t('feedback.send')}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={close}
                  style={{ paddingVertical: 10, alignItems: 'center' }}
                >
                  <AppText variant="secondary" color="inkFaint">
                    {t('feedback.cancel')}
                  </AppText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
