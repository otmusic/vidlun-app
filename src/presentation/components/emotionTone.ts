import type { Palette } from '../theme/tokens';
import type { Emotion } from '@/domain/entities/Emotion';


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

/** The midpoint of the 1-5 scale: 3 is neither still nor activated. */
const ENERGY_MIDPOINT = 3;

export function groupOf(emotion: Emotion): EmotionGroup {
  const activated = emotion.energy > ENERGY_MIDPOINT;

  if (emotion.valence >= 4) {
    return activated ? 'pleasantEnergetic' : 'pleasantCalm';
  }

  return activated ? 'tense' : 'heavy';
}

/**
 * §7.1 maps the scale, and the accent never appears in it: value 1 is the warm
 * terracotta, 2 and 3 the tension amber, 4 and up the calm green. A person
 * logging a hard day must not meet the colour of a fire alarm.
 */
export function moodTone(mood: number): keyof Palette {
  if (mood <= 1) {
    return 'low';
  }

  return mood <= 3 ? 'tension' : 'calm';
}
