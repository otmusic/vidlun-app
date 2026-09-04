import { Pressable, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

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
  /** Filled with its own colour outright — the drawing's kept word. */
  readonly solid?: boolean;
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

/**
 * Whether a colour is light enough that paper-coloured text would sink into
 * it. The drawing reads this off the colour itself rather than off the theme,
 * because an emotion's hue is the same on both grounds and only some of them
 * are pale.
 */
function isLightTone(hex: string): boolean {
  const value = hex.replace('#', '').slice(0, 6);

  if (value.length !== 6) {
    return false;
  }

  const channel = (at: number): number => parseInt(value.slice(at, at + 2), 16) / 255;
  const linear = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance =
    0.2126 * linear(channel(0)) + 0.7152 * linear(channel(2)) + 0.0722 * linear(channel(4));

  return luminance > 0.45;
}

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
  /*
   * On a solid chip the text takes the ink that reads on that colour: paper
   * on a deep one, ink on a pale one. The remove mark then sits in a circle
   * of the same text colour at a whisper, so it is visible on every chip —
   * the old single-colour glyph vanished on the very chips it was for.
   */
  const solidOnLight = props.solid === true && isLightTone(line);
  const text =
    props.solid === true
      ? solidOnLight
        ? theme.palette.ink
        : theme.palette.onSolid
      : (props.color ?? theme.palette[tone.ink]);
  const removeCircle = solidOnLight ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.26)';
  /*
   * A selected chip fills with its own colour at a whisper rather than with a
   * shelf colour, so the fill agrees with the ring around it. Eight-digit hex
   * is the only way to say "this colour, faintly" without a second token.
   */
  const fill = props.color === undefined ? theme.palette[tone.soft] : `${props.color}22`;
  const removable = props.action === 'remove';

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: removable ? 8 : theme.spacing.xs,
        borderRadius: theme.radii.pill,
        paddingLeft: removable ? 16 : 15,
        paddingRight: removable ? 9 : 15,
        paddingVertical: theme.spacing.sm,
        backgroundColor: props.solid === true ? line : filled ? fill : 'transparent',
        borderWidth: 1.5,
        borderColor: line,
      }}
    >
      <AppText variant="secondary" style={{ color: text }}>
        {props.label}
      </AppText>
      {removable ? (
        props.solid === true ? (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: removeCircle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg viewBox="0 0 12 12" width={9} height={9}>
              <Path
                d="M2 2l8 8M10 2l-8 8"
                stroke={text}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
        ) : (
          <Icon name="x" size={12} color={tone.ink} />
        )
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
