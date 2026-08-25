import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * Tone carries meaning, so it is never the only carrier: every chip also shows
 * its label, and a heavy state never gets a warning colour or an alarm icon.
 */
export type ChipTone = 'calm' | 'tension' | 'low' | 'neutral' | 'warm';

export interface ChipProps {
  readonly label: string;
  readonly tone?: ChipTone;
  readonly selected?: boolean;
  readonly outlined?: boolean;
  readonly action?: 'remove' | 'add';
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
}

const TONE_COLORS: Record<ChipTone, { soft: keyof Palette; ink: keyof Palette; solid: keyof Palette }> =
  {
    calm: { soft: 'calmSoft', ink: 'calmInk', solid: 'calm' },
    tension: { soft: 'tensionSoft', ink: 'tensionInk', solid: 'tension' },
    low: { soft: 'lowSoft', ink: 'lowInk', solid: 'low' },
    neutral: { soft: 'lineSoft', ink: 'inkSoft', solid: 'lineStrong' },
    warm: { soft: 'warmSoft', ink: 'warmInk', solid: 'warm' },
  };

export function Chip(props: ChipProps): React.JSX.Element {
  const theme = useTheme();
  const tone = TONE_COLORS[props.tone ?? 'neutral'];
  const filled = props.outlined !== true;

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        borderRadius: theme.radii.pill,
        paddingHorizontal: 13,
        paddingVertical: theme.spacing.sm,
        backgroundColor: filled ? theme.palette[tone.soft] : 'transparent',
        borderWidth: props.selected === true ? 1.5 : filled ? 0 : 1,
        borderColor: theme.palette[tone.solid],
      }}
    >
      <AppText variant="label" color={tone.ink}>
        {props.label}
      </AppText>
      {props.action === 'remove' ? <Icon name="x" size={12} color={tone.ink} /> : null}
      {props.action === 'add' && props.selected === true ? (
        <Icon name="check" size={12} color={tone.ink} />
      ) : null}
    </View>
  );

  if (props.onPress === undefined) {
    return body;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      hitSlop={8}
    >
      {body}
    </Pressable>
  );
}
