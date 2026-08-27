export interface Palette {
  readonly canvas: string;
  readonly paper: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly inkFaint: string;
  readonly line: string;
  readonly lineSoft: string;
  readonly lineStrong: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentInk: string;
  readonly onAccent: string;
  /**
   * The primary button is ink, not accent. In the new identity the loudest
   * control on a screen is the one with the most contrast rather than the most
   * colour, which leaves the accent free to mean one thing again.
   */
  readonly solid: string;
  readonly onSolid: string;
  /** A dark block inside a light screen, and the reverse at night. */
  readonly panel: string;
  readonly onPanel: string;
  /** Acid lime. It backs the record button and marks nothing else. */
  readonly lime: string;
  /** The same lime at fill strength, for a pill that must not shout. */
  readonly limeSoft: string;
  /** A filled square that is not a card: home-screen tiles, icon previews. */
  readonly tile: string;
  readonly tileInk: string;
  readonly warm: string;
  readonly warmSoft: string;
  readonly warmInk: string;
  readonly calm: string;
  readonly calmSoft: string;
  readonly calmInk: string;
  readonly tension: string;
  readonly tensionSoft: string;
  readonly tensionInk: string;
  readonly low: string;
  readonly lowSoft: string;
  readonly lowInk: string;
}

export const lightPalette: Palette = {
  canvas: '#FBF7F0',
  paper: '#FFFCF6',
  ink: '#16181D',
  inkSoft: '#6C6F78',
  inkFaint: '#8A8D95',
  line: '#E2DACB',
  lineSoft: '#F7F1E6',
  lineStrong: '#CFC7B8',
  accent: '#12A594',
  accentSoft: '#E8F5F2',
  accentInk: '#0B7367',
  onAccent: '#FBF7F0',
  solid: '#16181D',
  onSolid: '#FBF7F0',
  panel: '#16181D',
  onPanel: '#FBF7F0',
  lime: '#D7F26B',
  limeSoft: '#EEF6D2',
  tile: '#DFD9CB',
  tileInk: '#6C6F78',
  warm: '#D08700',
  warmSoft: '#F7EEDC',
  warmInk: '#8A5D12',
  calm: '#6F9B00',
  calmSoft: '#EEF6D2',
  calmInk: '#4A6800',
  tension: '#D08700',
  tensionSoft: '#F7EEDC',
  tensionInk: '#8A5D12',
  low: '#C0663A',
  lowSoft: '#F6E7DF',
  lowInk: '#8F4530',
};

/**
 * A separate palette, not an inversion. Evening is the main usage scenario:
 * the canvas stays a warm near-black rather than pure black, the ink stays
 * off-white, and every hue lightens because colour goes grey on dark grounds.
 *
 * `warm` and `tension` now resolve to the same amber in both themes rather
 * than only at night. The old rule kept honey for achievements alone; the new
 * identity gives achievement no colour at all, so the collision is no longer a
 * collision — but nothing may start reading amber as "well done" either.
 */
export const darkPalette: Palette = {
  canvas: '#14161B',
  paper: '#1B1E25',
  ink: '#F2EEE6',
  inkSoft: '#A9AEB8',
  inkFaint: '#8B9099',
  line: '#2C313B',
  lineSoft: '#232833',
  lineStrong: '#343943',
  accent: '#35D6C2',
  accentSoft: '#16302D',
  accentInk: '#6FE4D3',
  onAccent: '#14161B',
  solid: '#F2EEE6',
  onSolid: '#14161B',
  panel: '#22262F',
  onPanel: '#F2EEE6',
  lime: '#AFD64A',
  limeSoft: '#27311C',
  tile: '#2A2F38',
  tileInk: '#A9AEB8',
  warm: '#F0AE2E',
  warmSoft: '#2E2519',
  warmInk: '#F5C766',
  calm: '#AFD64A',
  calmSoft: '#27311C',
  calmInk: '#C4E176',
  tension: '#F0AE2E',
  tensionSoft: '#2E2519',
  tensionInk: '#F5C766',
  low: '#E0875C',
  lowSoft: '#2E1F1A',
  lowInk: '#EBA684',
};

/** An 8-grid, with 4 reserved for the gaps inside a control. */
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/**
 * `pill` is a number large enough to round any height this app uses. React
 * Native has no percentage radius on a rectangle, so the design's 999px arrives
 * as a value that simply exceeds every control it lands on.
 */
export const radii = { card: 22, control: 999, pill: 999, tile: 18 } as const;

/** Anything a finger lands on. Icons may look smaller; the target may not. */
export const MIN_TAP_TARGET = 44;

/** List rows are tapped without aiming. */
export const LIST_ROW_HEIGHT = 52;

/**
 * Two families with a strict role split, as before — but the split moved. It
 * used to be serif for anything Vidlun says and sans for the interface. The
 * new identity carries the voice in a wide display face and sets every
 * readable line, prose included, in the text face. So the boundary is now
 * headline against text rather than voice against chrome.
 *
 * Unbounded also sets the figures. The old rule kept numbers out of the voice
 * face because a serif renders them unevenly; a geometric display face with
 * tabular figures does not have that problem.
 */
export const fonts = {
  display: 'Unbounded_500Medium',
  displayLight: 'Unbounded_400Regular',
  numeric: 'Unbounded_500Medium',
  body: 'IBMPlexSans_400Regular',
  label: 'IBMPlexSans_500Medium',
  strong: 'IBMPlexSans_600SemiBold',
} as const;

export interface TextStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing?: number;
  readonly textTransform?: 'uppercase';
}

export interface Typography {
  /** Unbounded. Headlines, and the one line a screen is about. */
  readonly hero: TextStyle;
  readonly display: TextStyle;
  /** Unbounded at its lighter weight: the small label above a headline. */
  readonly kicker: TextStyle;
  /** The paragraph under a headline, one step above body. */
  readonly lede: TextStyle;
  /** Unbounded again, with tabular figures. Never for words. */
  readonly numeric: TextStyle;
  /** IBM Plex Sans. Everything meant to be read. */
  readonly narrative: TextStyle;
  readonly quote: TextStyle;
  readonly body: TextStyle;
  readonly label: TextStyle;
  readonly secondary: TextStyle;
  readonly caption: TextStyle;
}

/**
 * Line heights are multiplied by the system font scale so that text containers
 * grow with Dynamic Type instead of clipping. Nothing here sets a fixed height.
 */
export function createTypography(fontScale: number): Typography {
  const scaled = (size: number, ratio: number): number => Math.round(size * ratio * fontScale);

  return {
    // Unbounded is a wide face; without the negative tracking the headline
    // reads as spaced-out rather than set.
    hero: { fontFamily: fonts.display, fontSize: 31, lineHeight: scaled(31, 1.16), letterSpacing: -0.9 },
    display: { fontFamily: fonts.display, fontSize: 27, lineHeight: scaled(27, 1.15), letterSpacing: -0.8 },
    kicker: { fontFamily: fonts.displayLight, fontSize: 19, lineHeight: scaled(19, 1.3), letterSpacing: -0.2 },
    lede: { fontFamily: fonts.body, fontSize: 17, lineHeight: scaled(17, 1.55) },
    numeric: { fontFamily: fonts.numeric, fontSize: 16, lineHeight: scaled(16, 1.2) },
    narrative: { fontFamily: fonts.body, fontSize: 15, lineHeight: scaled(15, 1.6) },
    // The transcript keeps its 16, alone among the text styles: people re-read
    // their own entries at night, and this is the line they come back to.
    quote: { fontFamily: fonts.body, fontSize: 16, lineHeight: scaled(16, 1.6) },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: scaled(15, 1.6) },
    label: { fontFamily: fonts.label, fontSize: 15, lineHeight: scaled(15, 1.4) },
    secondary: { fontFamily: fonts.body, fontSize: 14, lineHeight: scaled(14, 1.5) },
    // The eyebrow above a block: 13 with a tenth of an em of tracking, which
    // is what makes uppercase readable rather than shouted.
    caption: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: scaled(13, 1.4),
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
  };
}

/** Predictable and alive, without bounce. */
export const SPRING = { damping: 18, stiffness: 220, mass: 0.9 } as const;
