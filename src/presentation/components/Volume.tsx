import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The whole app's light turned down together: the first try read a touch
 * loud on home, and a quarter less was the owner's word (2026-11-11).
 */
const SOFTNESS = 0.75;

/**
 * A little volume laid over a flat shape: light from the upper left, a soft
 * gloss there, a bright rim along the top and the far edge settling into
 * shade — the affirmation charms' own language, brought to the rest of the
 * app without raising its voice (owner's word, 2026-11-11: "not flat, a bit
 * 3D, not intrusively").
 *
 * Only on things one touches or that stand for the person's own doing — the
 * record button, the week's days, the streak. Never on a surface that holds
 * text about feelings: those stay flat paper, as §7 keeps them.
 *
 * It fills its parent and measures it, so the parent only needs its own size
 * and corner radius.
 */
export function Volume(props: {
  /** The parent's corner radius; 'round' for a disc or a pill. */
  readonly radius: number | 'round';
  /** How much light, 0 to 1: a dark ground or an ink surface wants less. */
  readonly strength?: number;
  /**
   * How much of that light gathers into the gloss, 0 to 1. On ink a gloss
   * of any size reads as a billiard ball, so the record button keeps it faint.
   */
  readonly gloss?: number;
}): React.JSX.Element {
  const [box, setBox] = useState<{ readonly width: number; readonly height: number } | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const k = (props.strength ?? 1) * SOFTNESS;
  const gloss = props.gloss ?? 1;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;

        setBox({ width, height });
      }}
    >
      {box === null || box.width === 0 ? null : (
        <Lit id={id} width={box.width} height={box.height} radius={props.radius} k={k} gloss={gloss} />
      )}
    </View>
  );
}

function Lit(props: {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly radius: number | 'round';
  readonly k: number;
  readonly gloss: number;
}): React.JSX.Element {
  const { id, width: w, height: h, k } = props;
  const r = props.radius === 'round' ? Math.min(w, h) / 2 : props.radius;
  // A long pill keeps its gloss level along the top; a round shape tilts it with the light.
  const long = w > h * 1.6;
  const glossX = long ? w * 0.3 : w * 0.32;
  const glossY = h * (long ? 0.24 : 0.2);
  const glossTilt = long ? 0 : -22;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient
          id={`light${id}`}
          gradientUnits="userSpaceOnUse"
          cx={w * 0.32}
          cy={h * 0.16}
          r={Math.max(w, h) * 0.95}
        >
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45 * k} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.78" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.16 * k} />
        </RadialGradient>
        <LinearGradient id={`rim${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={h}>
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55 * k} />
          <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <ClipPath id={`clip${id}`}>
          <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} fill={`url(#light${id})`} />
      <G clipPath={`url(#clip${id})`}>
        <Ellipse
          cx={glossX}
          cy={glossY}
          rx={w * (long ? 0.26 : 0.22)}
          ry={Math.max(h * (long ? 0.13 : 0.1), 3)}
          fill="#FFFFFF"
          opacity={0.26 * k * props.gloss}
          rotation={glossTilt}
          originX={glossX}
          originY={glossY}
        />
      </G>
      <Rect
        x={0.5}
        y={0.5}
        width={w - 1}
        height={h - 1}
        rx={Math.max(r - 0.5, 0)}
        ry={Math.max(r - 0.5, 0)}
        fill="none"
        stroke={`url(#rim${id})`}
        strokeWidth={1}
      />
    </Svg>
  );
}
