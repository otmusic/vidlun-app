import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Volume } from './Volume';
import { charmTint, Face, type BloomOrigin, type Charm, type CharmTint } from './AffirmationCharm';
import { useTheme } from '../theme/ThemeProvider';

/** The same round size as the filter beside it in the journal. */
const SIZE = 44;
/** A face needs more room than an icon to read at this size. */
const FACE = 30;
/** The head has more in it than an icon, so it gets a little more room. */
const HEAD = 23;

/*
 * The waiting mark's own colour, kept out of the six the picks are drawn in
 * (owner's word, 2026-11-10): a pastel orchid, from the widest gap the six
 * leave on the wheel, between the lavender and the pink, so nobody takes it
 * for an affirmation already picked. A night indigo first, which the owner
 * found too dark beside the pastels.
 */
const WAITING_LIGHT: CharmTint = { fill: '#F1D7F6', deep: '#9C47A8' };
const WAITING_DARK: CharmTint = { fill: '#3F2645', deep: '#E2A8EC' };

/**
 * The affirmation in the journal's header (owner's word, 2026-11-10): before
 * this period's is picked, always the same mark, a head with a spark of light
 * inside it, in a colour of its own, which opens the five; once it is, the
 * picked one's colour and face, which grow to the whole screen again. A plain
 * circle either way: at this size a cloud reads as a circle cut off. The
 * press reports where the button sits, so the colour can grow out of it.
 */
export function AffirmationButton(props: {
  /** The picked one's look; null while this period's is still to be picked. */
  readonly picked: Charm | null;
  readonly label: string;
  readonly onPress: (origin: BloomOrigin) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const button = useRef<View>(null);
  const waiting = theme.isDark ? WAITING_DARK : WAITING_LIGHT;
  const tint = props.picked === null ? waiting : charmTint(props.picked.tint, theme.isDark);

  return (
    <Pressable
      ref={button}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      hitSlop={4}
      onPress={() => {
        button.current?.measureInWindow((x, y, width, height) => {
          props.onPress({ x: x + width / 2, y: y + height / 2, size: Math.min(width, height) });
        });
      }}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: tint.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* A small sphere, kin to the charms it opens. */}
      <Volume radius="round" strength={theme.isDark ? 0.35 : 0.9} />
      {props.picked === null ? (
        <BrightHead color={tint.deep} size={HEAD} />
      ) : (
        <Face face={props.picked.glyph} color={tint.deep} size={FACE} />
      )}
    </Pressable>
  );
}

/*
 * A head in profile with light inside it (owner's word, 2026-11-10, in place
 * of a magic wand): the affirmation is a thought to carry, not a trick.
 * Drawn rather than taken from the icon set, which has no such head, and a
 * second icon font for one glyph is not worth its weight. The outline is
 * stroked like Feather; the sparks are filled, or at this size they smudge.
 */
function BrightHead(props: { readonly color: string; readonly size: number }): React.JSX.Element {
  return (
    <Svg width={props.size} height={props.size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 21v-3.5C5.6 15.9 4.5 13.6 4.5 11c0-4.4 3.6-8 8-8 4.1 0 7 2.9 7 6.6l1.5 3-1.5.5v2.1c0 1.1-.9 2-2 2h-2V21"
        stroke={props.color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.3 6.4c.36 2.15 1.33 3.12 3.48 3.48-2.15.36-3.12 1.33-3.48 3.48-.36-2.15-1.33-3.12-3.48-3.48 2.15-.36 3.12-1.33 3.48-3.48z"
        fill={props.color}
      />
      <Path
        d="M15.7 5.2c.14.82.5 1.18 1.32 1.32-.82.14-1.18.5-1.32 1.32-.14-.82-.5-1.18-1.32-1.32.82-.14 1.18-.5 1.32-1.32z"
        fill={props.color}
      />
    </Svg>
  );
}
