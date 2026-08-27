import type { Emotion } from '@/domain/entities/Emotion';
import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';

/**
 * Every emotion's colour, derived rather than assigned.
 *
 * The vocabulary holds 125 words and the identity names 17 of them by hand, so
 * the other 108 have to come from somewhere that cannot drift. They come from
 * the two numbers each word already carries: valence and energy.
 *
 * Working in OKLCH is what makes the result safe rather than merely varied.
 * Lightness is fixed per theme, so no emotion looks heavier than another
 * because of brightness alone, and contrast against the page holds for all of
 * them at once. Chroma is distance from the neutral centre, so an ordinary
 * state is nearly colourless and only an extreme one is saturated — under a
 * single ceiling, so nothing shouts.
 */

/** Hue at the four corners of the (valence, energy) square, in OKLCH degrees. */
const CORNER = {
  heavyStill: 248,
  tenseActivated: 292,
  pleasantStill: 186,
  pleasantActivated: 78,
} as const;

/**
 * Anger reads as its own family only if it is pulled into the warm arc.
 * Without this, "annoyed" and "anxious" land on the same hue — both unpleasant
 * and activated — and the wheel loses the one distinction people make first.
 *
 * The domain still stops short of the signal range: terracotta is the floor,
 * and no emotion is ever the colour of an alarm. A red border on a heavy
 * feeling says something is wrong with the person, which is the one thing this
 * product must never say.
 */
const ANGER_ARC = { from: 44, to: 60 } as const;
const ANGER_ROOT = 'angry';

const LIGHTNESS = { light: 0.58, dark: 0.8 } as const;
const CHROMA_CEILING = 0.13;

/** One generation down: a shade more colour, a shade less light. */
const DEPTH_CHROMA_STEP = 0.016;
const DEPTH_LIGHTNESS_STEP = 0.025;

const SCALE_MIN = 1;
const SCALE_MAX = 5;

/**
 * The words the identity fixes by hand. The function never touches these — a
 * brand colour that drifts because someone retuned a valence is not a brand
 * colour. Ids, not labels, so translations cannot break the join.
 */
const ANCHORS: Readonly<Record<string, { readonly light: string; readonly dark: string }>> = {
  'happy.proud': { light: '#D08700', dark: '#F0AE2E' },
  'happy.peaceful.thankful': { light: '#6F9B00', dark: '#AFD64A' },
  'happy.accepted': { light: '#9B51E0', dark: '#C08BF0' },
  'bad.tired': { light: '#7A8699', dark: '#A3AEC0' },
  'bad.tired.drained': { light: '#7A8699', dark: '#A3AEC0' },
  'angry.frustrated.annoyed': { light: '#C0663A', dark: '#E0875C' },
  'fearful.anxious': { light: '#4433E0', dark: '#8B7BFF' },
  'sad.lonely': { light: '#2E7DE9', dark: '#6BAEFF' },
  'compound.relief_after_effort': { light: '#12A594', dark: '#35D6C2' },
};

export type ColorScheme = 'light' | 'dark';

/**
 * The colour a word is drawn in. `family` is the emotion's root, and it is
 * consulted for one thing only: whether this branch is anger, which is pulled
 * into the warm arc. Everything else comes from the word's own two numbers.
 *
 * Depth never shifts the hue. A branch still reads as one thing because a
 * child's coordinates sit near its parent's — "drained" is a more extreme
 * "tired", not a different feeling — so the family holds together by meaning
 * rather than by a rule that would flatten furious and numb into one colour.
 */
export function emotionColor(emotion: Emotion, family: Emotion, scheme: ColorScheme): string {
  const anchor = ANCHORS[emotion.id];

  if (anchor !== undefined) {
    return anchor[scheme];
  }

  const hue = hueOf(emotion, family.id === ANGER_ROOT);
  const generations = emotion.depth - 1;
  const chroma = Math.min(
    CHROMA_CEILING,
    chromaOf(emotion) + generations * DEPTH_CHROMA_STEP,
  );
  const lightness = LIGHTNESS[scheme] - generations * DEPTH_LIGHTNESS_STEP;

  return toHex(oklchToRgb(lightness, chroma, hue));
}

function hueOf(emotion: Emotion, isAnger: boolean): number {
  if (isAnger) {
    return lerp(ANGER_ARC.from, ANGER_ARC.to, normalize(emotion.energy));
  }

  const valence = normalize(emotion.valence);
  const energy = normalize(emotion.energy);

  return lerp(
    lerp(CORNER.heavyStill, CORNER.tenseActivated, energy),
    lerp(CORNER.pleasantStill, CORNER.pleasantActivated, energy),
    valence,
  );
}

/**
 * Distance from the middle of the square, not from either axis. A word that is
 * neither pleasant nor unpleasant and neither still nor activated is the one
 * with no colour to speak of, whichever way it leans.
 */
function chromaOf(emotion: Emotion): number {
  const dv = normalize(emotion.valence) - 0.5;
  const de = normalize(emotion.energy) - 0.5;
  const furthest = Math.SQRT1_2;

  return (Math.hypot(dv, de) / furthest) * CHROMA_CEILING;
}

function normalize(value: number): number {
  return (clamp(value, SCALE_MIN, SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
}

function lerp(from: number, to: number, at: number): number {
  return from + (to - from) * at;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** OKLCH to sRGB, by way of OKLab and the linear primaries. */
function oklchToRgb(lightness: number, chroma: number, hueDegrees: number): Rgb {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

function gamma(channel: number): number {
  const linear = clamp(channel, 0, 1);

  return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
}

function toHex(rgb: Rgb): string {
  const channel = (value: number): string =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

/**
 * The colour for a word, given the book it came from. Callers hold a
 * vocabulary rather than a family, so this saves every one of them from
 * knowing that a root is the first segment of an id.
 */
export function colorForEmotion(
  vocabulary: EmotionVocabulary,
  emotion: Emotion,
  scheme: ColorScheme,
): string {
  const rootId = emotion.id.split('.')[0] ?? emotion.id;

  return emotionColor(emotion, vocabulary.find(rootId) ?? emotion, scheme);
}
