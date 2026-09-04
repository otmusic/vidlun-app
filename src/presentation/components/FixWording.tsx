import { useState } from 'react';
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Translate } from '@/i18n';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * The drawing's repair control, the same on the card being made and on the
 * card already kept: the quote with a pencil pill under it, and — once
 * tapped — the text in a ring of ink with a solid "done" and the reason the
 * control exists. Recognition is the one thing on either card the person
 * can check and the model cannot.
 */
export function FixWording(props: {
  /** The sentence as it stands; what the editor opens with. */
  readonly text: string;
  readonly t: Translate;
  readonly onFix: (text: string) => void;
  readonly style?: StyleProp<ViewStyle>;
  /** The quote as the screen sets it; shown while reading, replaced while fixing. */
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  /** Null while reading; the text being fixed while fixing. */
  const [fixing, setFixing] = useState<string | null>(null);
  const { t } = props;

  if (fixing === null) {
    return (
      <View style={props.style}>
        {props.children}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFixing(props.text);
          }}
          hitSlop={8}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            borderWidth: 1,
            borderColor: theme.palette.line,
            backgroundColor: theme.palette.paper,
            borderRadius: 999,
            paddingVertical: 9,
            paddingHorizontal: 15,
          }}
        >
          <Icon name="edit-3" size={14} color="inkSoft" />
          <AppText variant="secondary" color="inkSoft">
            {t('detail.fix')}
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={props.style}>
      <TextInput
        value={fixing}
        onChangeText={setFixing}
        multiline
        autoFocus
        style={{
          ...theme.type.quote,
          minHeight: 5 * 25,
          color: theme.palette.ink,
          backgroundColor: theme.palette.paper,
          borderWidth: 1.5,
          borderColor: theme.palette.ink,
          borderRadius: 20,
          paddingVertical: 16,
          paddingHorizontal: 18,
          textAlignVertical: 'top',
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const text = fixing;

            setFixing(null);
            props.onFix(text);
          }}
          hitSlop={8}
          style={{
            borderRadius: 999,
            backgroundColor: theme.palette.solid,
            paddingVertical: 11,
            paddingHorizontal: 22,
          }}
        >
          <AppText variant="secondary" style={{ color: theme.palette.onSolid }}>
            {t('detail.fixDone')}
          </AppText>
        </Pressable>
        <AppText
          variant="caption"
          color="inkFaint"
          style={{ flex: 1, textTransform: 'none', letterSpacing: 0, fontSize: 12.5 }}
        >
          {t('detail.fixHint')}
        </AppText>
      </View>
    </View>
  );
}
