import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { AffirmationLook } from '@/domain/entities/KeptAffirmation';

export type CharmShape = 'circle' | 'cloud' | 'flower' | 'heart' | 'star';

/**
 * Five kinds for the five dealt, so a set never holds two of the same
 * (owner's word, 2026-11-10: no two circles, no two clouds; a heart and a
 * star joined them).
 */
export const CHARM_SHAPES: readonly CharmShape[] = ['circle', 'cloud', 'flower', 'heart', 'star'];

/** Where each shape's body sits in its box, so the face sits on the body and not the box. */
const FACE_SHIFT: Readonly<Record<CharmShape, number>> = {
  circle: 0,
  cloud: 0.1,
  flower: 0,
  heart: -0.06,
  star: 0.05,
};

/**
 * Happy faces, drawn, in place of the icons the shapes carried (owner's word,
 * 2026-11-10): every one glad, none of them a grimace or a face that could
 * read as judging, and eight of them, so no set of five repeats one.
 */
export type CharmFace = 'smile' | 'grin' | 'joy' | 'wink' | 'blush' | 'love' | 'starry' | 'cat';

export const CHARM_FACES: readonly CharmFace[] = [
  'smile',
  'grin',
  'joy',
  'wink',
  'blush',
  'love',
  'starry',
  'cat',
];

export interface CharmTint {
  /** The shape, and the whole screen once it is picked. */
  readonly fill: string;
  /** The face on it. */
  readonly deep: string;
}

/*
 * Soft colours of their own, kept to the affirmation. They mean nothing — not
 * a mood, not an emotion, not a control — which is why they may be many here
 * when everywhere else one colour means one thing (§7.1). Lighter on light,
 * deeper and quieter on dark, so the words on them read in either theme.
 */
const TINTS_LIGHT: readonly CharmTint[] = [
  { fill: '#FFDCCB', deep: '#D9704A' },
  { fill: '#F9D3DE', deep: '#C95A7C' },
  { fill: '#DED8FB', deep: '#6B5BCC' },
  { fill: '#D2E7FA', deep: '#3C7FBF' },
  { fill: '#CFEEDD', deep: '#3A9467' },
  { fill: '#FBECBC', deep: '#B98F17' },
];

const TINTS_DARK: readonly CharmTint[] = [
  { fill: '#4A2F26', deep: '#FFB79A' },
  { fill: '#472733', deep: '#F5A3BA' },
  { fill: '#2F2B50', deep: '#B9AEFF' },
  { fill: '#22364A', deep: '#9CCBF5' },
  { fill: '#203B2E', deep: '#9AD9B6' },
  { fill: '#463C1E', deep: '#F2D27A' },
];

export const CHARM_TINT_COUNT = TINTS_LIGHT.length;

export function charmTint(index: number, isDark: boolean): CharmTint {
  const tints = isDark ? TINTS_DARK : TINTS_LIGHT;

  return tints[index] ?? tints[0]!;
}

/** Where the colour starts, in the coordinates of whatever the bloom covers. */
export interface BloomOrigin {
  readonly x: number;
  readonly y: number;
  /** The circle it starts as. */
  readonly size: number;
}

/**
 * A look as the page draws it. The face is kept under the name `glyph`, which
 * is what the stored look has called it since the icons it replaced.
 */
export interface Charm {
  readonly shape: CharmShape;
  readonly tint: number;
  readonly glyph: CharmFace;
}

/**
 * A stored look read back. Anything this version does not draw — a shape
 * dropped, an icon from before the faces — falls back to the plainest one
 * rather than failing to show what the person picked.
 */
export function charmOf(look: AffirmationLook): Charm {
  const shape = CHARM_SHAPES.find((each) => each === look.shape) ?? 'circle';
  const glyph = CHARM_FACES.find((each) => each === look.glyph) ?? 'smile';
  const tint = Number.isInteger(look.tint) && look.tint >= 0 && look.tint < CHARM_TINT_COUNT ? look.tint : 0;

  return { shape, tint, glyph };
}

/** The shape in its colour with its face on it, at any size. */
export function CharmMark(props: {
  readonly charm: Charm;
  readonly tint: CharmTint;
  readonly size: number;
}): React.JSX.Element {
  const { shape, glyph } = props.charm;
  const lower = props.size * FACE_SHIFT[shape];

  return (
    <View style={{ width: props.size, height: props.size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={props.size} height={props.size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <ShapeOf shape={shape} fill={props.tint.fill} />
      </Svg>
      <View style={{ marginTop: lower }}>
        <Face face={glyph} color={props.tint.deep} size={props.size * 0.5} />
      </View>
    </View>
  );
}

/** Eyes and a mouth, in a 40-point box, stroked round like everything else here. */
export function Face(props: {
  readonly face: CharmFace;
  readonly color: string;
  readonly size: number;
}): React.JSX.Element {
  const stroke = {
    stroke: props.color,
    strokeWidth: 2.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={props.size} height={props.size} viewBox="0 0 40 40">
      <FaceEyes face={props.face} color={props.color} stroke={stroke} />
      <FaceMouth face={props.face} color={props.color} stroke={stroke} />
      {props.face === 'blush' ? (
        <>
          <Ellipse cx={8.5} cy={23} rx={3.6} ry={2.2} fill={props.color} opacity={0.25} />
          <Ellipse cx={31.5} cy={23} rx={3.6} ry={2.2} fill={props.color} opacity={0.25} />
        </>
      ) : null}
    </Svg>
  );
}

interface FacePart {
  readonly face: CharmFace;
  readonly color: string;
  readonly stroke: {
    readonly stroke: string;
    readonly strokeWidth: number;
    readonly strokeLinecap: 'round';
    readonly strokeLinejoin: 'round';
    readonly fill: string;
  };
}

/** A small heart, centred on (x, y). */
function heart(x: number, y: number): string {
  return `M${x} ${y + 3.2}c-2.6-1.9-4.3-3.3-4.3-5.1 0-1.3 1-2.3 2.2-2.3.9 0 1.6.5 2.1 1.2.5-.7 1.2-1.2 2.1-1.2 1.2 0 2.2 1 2.2 2.3 0 1.8-1.7 3.2-4.3 5.1z`;
}

/** A four-point star, centred on (x, y). */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.28;

  return `M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`;
}

function FaceEyes(props: FacePart): React.JSX.Element {
  switch (props.face) {
    case 'joy':
      return (
        <>
          <Path d="M10.5 17.5Q14 13 17.5 17.5" {...props.stroke} />
          <Path d="M22.5 17.5Q26 13 29.5 17.5" {...props.stroke} />
        </>
      );
    case 'wink':
      return (
        <>
          <Circle cx={14} cy={16} r={2.4} fill={props.color} />
          <Path d="M22.5 16.5Q26 13.5 29.5 16.5" {...props.stroke} />
        </>
      );
    case 'love':
      return (
        <>
          <Path d={heart(14, 15.5)} fill={props.color} />
          <Path d={heart(26, 15.5)} fill={props.color} />
        </>
      );
    case 'starry':
      return (
        <>
          <Path d={sparkle(14, 16, 4)} fill={props.color} />
          <Path d={sparkle(26, 16, 4)} fill={props.color} />
        </>
      );
    default:
      return (
        <>
          <Circle cx={14} cy={16} r={2.4} fill={props.color} />
          <Circle cx={26} cy={16} r={2.4} fill={props.color} />
        </>
      );
  }
}

function FaceMouth(props: FacePart): React.JSX.Element {
  switch (props.face) {
    case 'grin':
    case 'starry':
      return <Path d="M12.5 22.5H27.5Q27.5 30.5 20 30.5Q12.5 30.5 12.5 22.5Z" fill={props.color} />;
    case 'cat':
      return <Path d="M13 23.5Q16.5 27.5 20 23.5Q23.5 27.5 27 23.5" {...props.stroke} />;
    case 'blush':
      return <Path d="M15.5 24Q20 27.5 24.5 24" {...props.stroke} />;
    default:
      return <Path d="M13 23Q20 30 27 23" {...props.stroke} />;
  }
}

/** Drawn from circles alone, so every shape keeps the same soft edge. */
function ShapeOf(props: { readonly shape: CharmShape; readonly fill: string }): React.JSX.Element {
  if (props.shape === 'cloud') {
    return (
      <>
        {/* As wide and as tall as the others, or it reads as the small one. */}
        <Circle cx={28} cy={58} r={24} fill={props.fill} />
        <Circle cx={54} cy={42} r={32} fill={props.fill} />
        <Circle cx={78} cy={60} r={22} fill={props.fill} />
        <Rect x={4} y={54} width={96} height={32} rx={16} fill={props.fill} />
      </>
    );
  }

  if (props.shape === 'flower') {
    return (
      <>
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <Circle
            key={angle}
            cx={50 + 26 * Math.cos((angle * Math.PI) / 180)}
            cy={50 + 26 * Math.sin((angle * Math.PI) / 180)}
            r={21}
            fill={props.fill}
          />
        ))}
        <Circle cx={50} cy={50} r={26} fill={props.fill} />
      </>
    );
  }

  if (props.shape === 'heart') {
    return (
      <Path
        d="M50 90C22 70 5 54 5 34 5 19 16 8 30 8c9 0 16 5 20 12 4-7 11-12 20-12 14 0 25 11 25 26 0 20-17 36-45 56z"
        fill={props.fill}
      />
    );
  }

  if (props.shape === 'star') {
    // Chubby, with its points rounded by a stroke of its own colour, so it keeps the soft edge.
    return (
      <Path
        d="M50.0 12.0 L63.5 35.4 L89.9 41.0 L71.9 61.1 L74.7 88.0 L50.0 77.0 L25.3 88.0 L28.1 61.1 L10.1 41.0 L36.5 35.4 Z"
        fill={props.fill}
        stroke={props.fill}
        strokeWidth={12}
        strokeLinejoin="round"
      />
    );
  }

  return <Circle cx={50} cy={50} r={48} fill={props.fill} />;
}
