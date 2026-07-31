export const EMOTION_DEPTHS = [1, 2, 3] as const;

/** Feeling Wheel level: `sad` (1) -> `sad.lonely` (2) -> `sad.lonely.abandoned` (3). */
export type EmotionDepth = (typeof EMOTION_DEPTHS)[number];

export const MAX_EMOTION_DEPTH: EmotionDepth = 3;

export function isEmotionDepth(value: number): value is EmotionDepth {
  return (EMOTION_DEPTHS as readonly number[]).includes(value);
}
