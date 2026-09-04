import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
 *
 * Drawn into the screen rather than through a Modal, and that is not a
 * style choice: inside a Modal on iOS 26 the first touch anywhere outside
 * the field went to putting the keyboard away, the sheet dropped under the
 * finger, and "Send" needed a second tap. The same field and buttons in the
 * tree — as on the text-entry screen — take the tap the first time.
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
  /* Zero is below the screen, one is in place: the slide a Modal used to give. */
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!props.open) {
      rise.setValue(0);

      return;
    }

    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) {
        return;
      }

      if (reduced) {
        rise.setValue(1);

        return;
      }

      Animated.timing(rise, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      cancelled = true;
    };
  }, [props.open, rise]);

  if (!props.open) {
    return null;
  }

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
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('feedback.cancel')}
        onPress={close}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,12,16,0.42)' }}
      />
      {/*
        * The keyboard rises over a sheet pinned to the bottom, so the sheet
        * rises with it: "Send" under the keys is a note that cannot be sent.
        * The keyboard goes with the sheet, or with "Send".
        */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' }}
      >
        <Animated.View
          style={{
            backgroundColor: theme.palette.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
            transform: [
              {
                translateY: rise.interpolate({
                  inputRange: [0, 1],
                  outputRange: [windowHeight * 0.45, 0],
                }),
              },
            ],
          }}
        >
          <View style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 30, gap: 12 }}>
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
              * The drawing greys the button rather than hiding it while the
              * field is empty: the way forward stays visible, it just is not
              * open yet.
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
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
