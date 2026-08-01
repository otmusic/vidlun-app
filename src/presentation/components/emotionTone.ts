import type { Emotion } from '@/domain/entities/Emotion';

import type { ChipTone } from './Chip';

/**
 * The drill-down groups people actually recognise, read off valence and energy
 * rather than off the Feeling Wheel branch: "pleasant but drained" and
 * "pleasant and lively" are different shelves to reach for.
 */
export type EmotionGroup = 'pleasantCalm' | 'pleasantEnergetic' | 'tense' | 'heavy';

export const EMOTION_GROUPS: readonly EmotionGroup[] = [
  'pleasantCalm',
  'pleasantEnergetic',
  'tense',
  'heavy',
];

export function groupOf(emotion: Emotion): EmotionGroup {
  if (emotion.valence >= 4) {
    return emotion.energy === 'low' ? 'pleasantCalm' : 'pleasantEnergetic';
  }

  return emotion.energy === 'high' ? 'tense' : 'heavy';
}

export function toneOf(emotion: Emotion): ChipTone {
  const group = groupOf(emotion);

  if (group === 'pleasantCalm' || group === 'pleasantEnergetic') {
    return 'calm';
  }

  return group === 'tense' ? 'tension' : 'low';
}
