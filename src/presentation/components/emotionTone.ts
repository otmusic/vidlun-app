import type { Emotion } from '@/domain/entities/Emotion';

import type { Palette } from '../theme/tokens';

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

/** About three rows of chips: a handful to choose from, not the palette. */
export const NEAR_COUNT = 8;

/** Four and up on the mood scale reads as a good day; two and under as a hard one. */
const GOOD_MOOD = 4;
const HARD_MOOD = 2;


const isPleasant = (emotion: Emotion): boolean => emotion.valence >= GOOD_MOOD;

/**
 * The words the question card offers for what was said (owner's word,
 * 2026-09-30): a handful, nearest first, never the whole palette. The person
 * types their own word when none of them fits.
 *
 * Read off what Vidlun heard, side by side and never averaged: a pleasant
 * reading is offered no hard word and a hard one no pleasant word, while a
 * mixed state — proud and exhausted — keeps both poles, taking turns from
 * each (§6). With no feeling heard the mood decides the side, and a level
 * mood offers both. Nearness weighs valence double: whether a feeling is
 * pleasant matters more here than how much energy it carries.
 *
 * From the owner's flat list of 2026-10-20, every word on the same footing,
 * and never a sensitive one: this list is the analysis speaking, and §6 bars
 * it from proposing those. Words that left the list are never offered.
 *
 * The chart alone is not meaning. Worry sits at the very point contempt,
 * judgement and resentment do, and a card that offered those for a worry
 * about a friend's birthday read as if Vidlun had not listened (owner's
 * word, 2026-10-23). So a heard word's own kind of feeling — its branch of
 * the wheel — comes before anything merely as close on the chart. This is
 * the fallback now: the reading itself names the words that fit the
 * sentence (`wordsOffered`), and this fills in when it named too few.
 */
export function emotionsNear(
  heard: readonly Emotion[],
  mood: number | null,
  pool: readonly Emotion[],
  count: number = NEAR_COUNT,
): readonly Emotion[] {
  const anchors: readonly Anchor[] =
    heard.length > 0
      ? heard.map((emotion) => ({
          id: emotion.id,
          rootId: emotion.rootId,
          valence: emotion.valence,
          energy: emotion.energy,
        }))
      : [{ id: null, rootId: null, valence: mood ?? 3, energy: 3 }];
  const pleasantSide =
    heard.length > 0 ? heard.some(isPleasant) : mood === null || mood > HARD_MOOD;
  const hardSide =
    heard.length > 0 ? heard.some((emotion) => !isPleasant(emotion)) : mood === null || mood < GOOD_MOOD;
  const candidates = offerable(pool).filter((emotion) =>
    isPleasant(emotion) ? pleasantSide : hardSide,
  );
  const order = new Map(candidates.map((emotion, at) => [emotion.id, at]));
  /*
   * The heard word's own branch first, nearest first within it and then
   * outside it; at the same distance the word that was heard itself, then
   * the more exact word before the broad one it sits under ("worried" before
   * "fearful"), then the wheel's own order so the card reads the same twice.
   */
  const ranked = anchors.map((anchor) =>
    [...candidates].sort(
      (a, b) =>
        Number(b.rootId === anchor.rootId) - Number(a.rootId === anchor.rootId) ||
        distance(a, anchor) - distance(b, anchor) ||
        Number(b.id === anchor.id) - Number(a.id === anchor.id) ||
        b.depth - a.depth ||
        (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    ),
  );
  const picked: Emotion[] = [];

  for (let rank = 0; picked.length < count && rank < candidates.length; rank += 1) {
    for (const list of ranked) {
      const next = list[rank];

      if (next !== undefined && picked.length < count && !picked.includes(next)) {
        picked.push(next);
      }
    }
  }

  return picked;
}

/**
 * The words the question card offers once Vidlun has read the entry: what it
 * heard, then the other words the reading put beside it — chosen by the
 * model that read the sentence, so they fit what was said and not only where
 * it sits on the chart — then, if that came to fewer than a handful, the
 * nearest words to fill the card.
 *
 * Gated here as well as where the reading lands: a sensitive or retired word
 * is never offered, whoever named it.
 */
export function wordsOffered(
  heard: readonly Emotion[],
  nearbyIds: readonly string[],
  mood: number | null,
  pool: readonly Emotion[],
  count: number = NEAR_COUNT,
): readonly Emotion[] {
  const allowed = new Map(offerable(pool).map((emotion) => [emotion.id, emotion]));
  const picked: Emotion[] = [];
  const offer = (emotion: Emotion | undefined): void => {
    if (emotion !== undefined && picked.length < count && !picked.includes(emotion)) {
      picked.push(emotion);
    }
  };

  heard.forEach((emotion) => offer(allowed.get(emotion.id)));
  nearbyIds.forEach((id) => offer(allowed.get(id)));
  emotionsNear(heard, mood, pool, pool.length).forEach(offer);

  return picked;
}

/**
 * What the card offers when there is no reading at all — Vidlun could not
 * listen: the broadest words still in the list (happy, surprised, fearful,
 * angry, disgusted and sad — the old roots that stayed), one per kind of
 * feeling.
 */
export function wordsWithoutReading(pool: readonly Emotion[]): readonly Emotion[] {
  return offerable(pool).filter((emotion) => emotion.depth === 1);
}

/** Current and not sensitive. Retired words stay readable but are never offered. */
function offerable(pool: readonly Emotion[]): readonly Emotion[] {
  return pool.filter((emotion) => emotion.isProposableByAi);
}

interface Anchor {
  /** The heard word the distance is measured from; null for a mood alone. */
  readonly id: string | null;
  /** Its branch of the wheel, whose words come first; null for a mood alone. */
  readonly rootId: string | null;
  readonly valence: number;
  readonly energy: number;
}

function distance(emotion: Emotion, anchor: Anchor): number {
  const valence = 2 * (emotion.valence - anchor.valence);
  const energy = emotion.energy - anchor.energy;

  return valence * valence + energy * energy;
}

/**
 * Three bands across five points, split where the words split them: `mood.1`
 * and `mood.2` are both low, `mood.3` is even, `mood.4` and `mood.5` are the
 * good end. Colouring a "low" day the same as an "even" one said something the
 * label denied.
 *
 * Kept apart from the scale, in plain TypeScript, because the week chart,
 * the mood line and every entry's marker colour by it too. Two mappings
 * drifted apart once already, and §7 asks that one colour mean exactly one
 * thing.
 */
export function toneFor(point: number): keyof Palette {
  if (point <= 2) {
    return 'low';
  }

  return point < 4 ? 'tension' : 'calm';
}
