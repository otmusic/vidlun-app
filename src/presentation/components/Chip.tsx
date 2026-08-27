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
  /**
   * The emotion's own colour, derived from its two axes. Given one, the chip
   * ignores `tone` entirely: tone puts a word on one of four shelves, and four
   * shelves were never meant to be a palette.
   */
  readonly color?: string;
  readonly tone?: ChipTone;
  readonly selected?: boolean;
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

  /*
   * A chip is a ring of its own colour around its own word, not a filled
   * lozenge. Four of these side by side used to be four blocks of colour on a
   * screen about feelings; outlined, the words carry the row and the colour
   * only names them. `filled` is what a selected chip becomes, so that picking
   * one is visible without a tick.
   */
  const filled = props.selected === true && props.action === 'add';
  const line = props.color ?? theme.palette[tone.solid];
  const text = props.color ?? theme.palette[tone.ink];
  /*
   * A selected chip fills with its own colour at a whisper rather than with a
   * shelf colour, so the fill agrees with the ring around it. Eight-digit hex
   * is the only way to say "this colour, faintly" without a second token.
   */
  const fill = props.color === undefined ? theme.palette[tone.soft] : `${props.color}22`;

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        borderRadius: theme.radii.pill,
        paddingHorizontal: 15,
        paddingVertical: theme.spacing.sm,
        backgroundColor: filled ? fill : 'transparent',
        borderWidth: 1.5,
        borderColor: line,
      }}
    >
      <AppText variant="secondary" style={{ color: text }}>
        {props.label}
      </AppText>
      {props.action === 'remove' ? <Icon name="x" size={12} color={tone.ink} /> : null}
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
