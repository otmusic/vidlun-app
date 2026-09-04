import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { CheckShape } from './Shapes';

type Phase = 'form' | 'sending' | 'sent';

/**
 * The drawing's feedback sheet: a note to whoever makes the app, typed as
 * is and sent as is. Two states — the form and the thank-you — and a quiet
 * line when the note did not go through, since a note that vanished would
 * be the worst possible answer to "what broke".
 */
export function FeedbackSheet(props: {
  readonly open: boolean;
  readonly t: Translate;
  readonly onSend: (text: string) => Promise<void>;
  readonly onClose: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = props;
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [failed, setFailed] = useState(false);
  const ready = text.trim().length > 0;

  const close = (): void => {
    setText('');
    setPhase('form');
    setFailed(false);
    props.onClose();
  };

  const send = (): void => {
    if (!ready || phase === 'sending') {
      return;
    }

    setPhase('sending');
    setFailed(false);

    props
      .onSend(text.trim())
      .then(() => {
        setPhase('sent');
      })
      .catch(() => {
        // The note stays in the field; nobody retypes what they just said.
        setPhase('form');
        setFailed(true);
      });
  };

  return (
    <Modal visible={props.open} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('feedback.cancel')}
          onPress={close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,12,16,0.42)' }}
        />
        <View
          style={{
            backgroundColor: theme.palette.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 24,
            paddingHorizontal: 20,
            paddingBottom: 30,
          }}
        >
          {phase === 'sent' ? (
            <View style={{ gap: 14 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderColor: theme.palette.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckShape color={theme.palette.accentInk} size={22} />
              </View>
              <AppText variant="display" style={{ fontSize: 22, lineHeight: 28 }}>
                {t('feedback.sentTitle')}
              </AppText>
              <AppText variant="secondary" color="inkSoft" style={{ fontSize: 14.5, lineHeight: 22 }}>
                {t('feedback.sentBody')}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={{
                  marginTop: 6,
                  borderRadius: 999,
                  backgroundColor: theme.palette.solid,
                  paddingVertical: 15,
                  alignItems: 'center',
                }}
              >
                <AppText variant="body" style={{ color: theme.palette.onSolid }}>
                  {t('feedback.sentClose')}
                </AppText>
              </Pressable>
            </View>
          ) : (
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
                editable={phase !== 'sending'}
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
                color={failed ? 'ink' : 'inkFaint'}
                style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, lineHeight: 19 }}
              >
                {failed ? t('feedback.failed') : t('feedback.note')}
              </AppText>
              {/*
                * The drawing greys the button rather than hiding it while the
                * field is empty: the way forward stays visible, it just is not
                * open yet.
                */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready || phase === 'sending' }}
                onPress={send}
                style={{
                  marginTop: 4,
                  borderRadius: 999,
                  backgroundColor: ready ? theme.palette.solid : theme.palette.line,
                  paddingVertical: 16,
                  alignItems: 'center',
                  opacity: phase === 'sending' ? 0.7 : 1,
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
          )}
        </View>
      </View>
    </Modal>
  );
}
