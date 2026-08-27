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
  canvas: '#EDF2F1',
  paper: '#FAFBFB',
  ink: '#26302F',
  inkSoft: '#61706E',
  inkFaint: '#93A09D',
  line: '#E2E6E6',
  lineSoft: '#ECF0EF',
  lineStrong: '#D6DCDB',
  accent: '#3E7C82',
  accentSoft: '#E2EDEE',
  accentInk: '#2F6167',
  onAccent: '#FFFFFF',
  warm: '#D9A05B',
  warmSoft: '#F7EBD8',
  warmInk: '#8A5E22',
  calm: '#3FA88A',
  calmSoft: '#E2F2EC',
  calmInk: '#1F6B54',
  tension: '#D8A268',
  tensionSoft: '#F8EEDF',
  tensionInk: '#8A5D12',
  low: '#C77B62',
  lowSoft: '#F7E6DF',
  lowInk: '#8F4530',
};

/**
 * A separate palette, not an inversion. Evening is the main usage scenario:
 * the canvas stays a deep sea green rather than black, the ink stays off-white,
 * and the warm hues lighten because warm colours go grey on dark backgrounds.
 *
 * Known collision from the design system: `warm` and `tension` resolve to the
 * same value here. The rule still holds — honey marks achievements only, never
 * a mood state — and separating them stays a one-line change.
 */
export const darkPalette: Palette = {
  canvas: '#101615',
  paper: '#19211F',
  ink: '#E7EBE8',
  inkSoft: '#A3B0AC',
  inkFaint: '#71807C',
  line: '#2A3432',
  lineSoft: '#232C2B',
  lineStrong: '#3A4644',
  accent: '#6FB8BC',
  accentSoft: '#1E2E30',
  accentInk: '#9AD3D6',
  onAccent: '#0C1413',
  warm: '#E0B77E',
  warmSoft: '#2E2519',
  warmInk: '#EBC894',
  calm: '#5FC7A6',
  calmSoft: '#162C26',
  calmInk: '#8ADCBF',
  tension: '#E0B77E',
  tensionSoft: '#2E2519',
  tensionInk: '#EBC894',
  low: '#D8907A',
  lowSoft: '#2E1F1A',
  lowInk: '#E9AC97',
};

/** An 8-grid, with 4 reserved for the gaps inside a control. */
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radii = { card: 14, control: 14, pill: 20 } as const;

/** Anything a finger lands on. Icons may look smaller; the target may not. */
export const MIN_TAP_TARGET = 44;

/** List rows are tapped without aiming. */
export const LIST_ROW_HEIGHT = 52;

export const fonts = {
  display: 'Fraunces_500Medium',
  narrative: 'Fraunces_400Regular',
  narrativeItalic: 'Fraunces_400Regular_Italic',
  body: 'Inter_400Regular',
  label: 'Inter_500Medium',
  strong: 'Inter_600SemiBold',
} as const;

export interface TextStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing?: number;
  readonly textTransform?: 'uppercase';
}

export interface Typography {
  /** Fraunces. Vidlun speaking. */
  readonly display: TextStyle;
  readonly narrative: TextStyle;
  readonly quote: TextStyle;
  /** Inter. The interface. */
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
    display: { fontFamily: fonts.display, fontSize: 25, lineHeight: scaled(25, 1.2) },
    narrative: { fontFamily: fonts.narrative, fontSize: 16, lineHeight: scaled(16, 1.65) },
    quote: { fontFamily: fonts.narrativeItalic, fontSize: 16, lineHeight: scaled(16, 1.65) },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: scaled(16, 1.6) },
    label: { fontFamily: fonts.label, fontSize: 15, lineHeight: scaled(15, 1.4) },
    secondary: { fontFamily: fonts.body, fontSize: 14, lineHeight: scaled(14, 1.5) },
    caption: {
      fontFamily: fonts.label,
      fontSize: 11.5,
      lineHeight: scaled(11.5, 1.4),
      letterSpacing: 0.46,
      textTransform: 'uppercase',
    },
  };
}

/** Predictable and alive, without bounce. */
export const SPRING = { damping: 18, stiffness: 220, mass: 0.9 } as const;
