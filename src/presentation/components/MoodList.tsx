import { Pressable, View } from 'react-native';

import type { Translate } from '@/i18n';

import { type Palette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { toneFor } from './emotionTone';
import { Icon } from './Icon';
import { moodKey } from './MoodLine';

/** The mood scale's soft ground and its ink, for the colour `toneFor` gives a point. */
function shadesOf(tone: keyof Palette): { readonly soft: keyof Palette; readonly ink: keyof Palette } {
  if (tone === 'low') {
    return { soft: 'lowSoft', ink: 'lowInk' };
  }

  return tone === 'tension' ? { soft: 'tensionSoft', ink: 'tensionInk' } : { soft: 'calmSoft', ink: 'calmInk' };
}

/**
 * The mood as five words, highest first, on a page of its own (owner's pick
 * of six drawings, 2026-11-23: the quiet list, without plates). A dot of the
 * mood's colour and its name; the chosen row alone takes the colour's soft
 * ground, a tick and bold letters, so the colour is never the only sign of
 * which one it is. A category, not a reading on a scale (2026-09-30): no
 * numbers and nothing filling up.
 */
export function MoodList(props: {
  /** Null when no mood is set: Vidlun heard none, and the person chose none. */
  readonly value: number | null;
  readonly t: Translate;
  readonly onChange: (value: number) => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={{ gap: 4, marginHorizontal: -16 }}>
      {[5, 4, 3, 2, 1].map((value) => {
        const tone = toneFor(value);
        const shades = shadesOf(tone);
        const chosen = props.value === value;

        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            accessibilityLabel={props.t(moodKey(value))}
            onPress={() => {
              props.onChange(value);
            }}
            style={{
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderRadius: theme.radii.tile,
              paddingHorizontal: 16,
              backgroundColor: chosen ? theme.palette[shades.soft] : 'transparent',
            }}
          >
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme.palette[tone] }} />
            <AppText
              variant={chosen ? 'label' : 'body'}
              color={chosen ? shades.ink : 'ink'}
              style={{ flex: 1, fontSize: 17 }}
            >
              {props.t(moodKey(value))}
            </AppText>
            {chosen ? <Icon name="check" size={20} color={tone} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
