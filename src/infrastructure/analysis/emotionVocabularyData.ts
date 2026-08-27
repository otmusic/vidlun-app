import { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { EmotionDefinition } from '../../domain/entities/Emotion';

/**
 * The Feeling Wheel (Gloria Willcox, 1982) plus a `compound` branch for the
 * concrete everyday states people actually say out loud.
 *
 * Ids are English and stable — they are the join key for display labels in
 * src/i18n and for revision logs, so renaming one breaks stored entries.
 * Depth and parent are read off the id, never listed here.
 *
 * `valence` is 1 (hardest) to 5 (best) and `energy` is 1 (still) to 5
 * (activated) — what the state does to the body. Together they drive the
 * drill-down grouping and, since the identity change, the colour of every
 * word that has no hand-picked one.
 * `sensitive` marks states Vidlun must never propose on its own.
 */
export const EMOTION_VOCABULARY_DATA: readonly EmotionDefinition[] = [
  { id: 'happy', valence: 5, energy: 4, tier: 'core' },
  { id: 'surprised', valence: 3, energy: 5, tier: 'core' },
  { id: 'bad', valence: 2, energy: 2, tier: 'core' },
  { id: 'fearful', valence: 2, energy: 4, tier: 'core' },
  { id: 'angry', valence: 2, energy: 5, tier: 'core' },
  { id: 'disgusted', valence: 2, energy: 4, tier: 'core' },
  { id: 'sad', valence: 1, energy: 1, tier: 'core' },
  { id: 'compound', valence: 3, energy: 3, tier: 'core' },

  { id: 'happy.playful', valence: 5, energy: 5, tier: 'core' },
  { id: 'happy.playful.cheeky', valence: 5, energy: 5, tier: 'extended' },
  { id: 'happy.playful.energetic', valence: 5, energy: 5, tier: 'extended' },
  { id: 'happy.content', valence: 5, energy: 2, tier: 'core' },
  { id: 'happy.content.free', valence: 5, energy: 3, tier: 'extended' },
  { id: 'happy.content.joyful', valence: 5, energy: 4, tier: 'extended' },
  { id: 'happy.proud', valence: 5, energy: 4, tier: 'core' },
  { id: 'happy.proud.successful', valence: 5, energy: 4, tier: 'extended' },
  { id: 'happy.proud.confident', valence: 5, energy: 3, tier: 'extended' },
  { id: 'happy.accepted', valence: 4, energy: 2, tier: 'core' },
  { id: 'happy.accepted.respected', valence: 4, energy: 2, tier: 'extended' },
  { id: 'happy.accepted.valued', valence: 4, energy: 2, tier: 'extended' },
  { id: 'happy.peaceful', valence: 4, energy: 1, tier: 'core' },
  { id: 'happy.peaceful.loving', valence: 5, energy: 2, tier: 'extended' },
  { id: 'happy.peaceful.thankful', valence: 5, energy: 2, tier: 'extended' },
  { id: 'happy.optimistic', valence: 5, energy: 4, tier: 'core' },
  { id: 'happy.optimistic.hopeful', valence: 4, energy: 3, tier: 'extended' },
  { id: 'happy.optimistic.inspired', valence: 5, energy: 5, tier: 'extended' },

  { id: 'surprised.startled', valence: 3, energy: 5, tier: 'core' },
  { id: 'surprised.startled.shocked', valence: 2, energy: 5, tier: 'extended' },
  { id: 'surprised.startled.dismayed', valence: 2, energy: 4, tier: 'extended' },
  { id: 'surprised.confused', valence: 3, energy: 3, tier: 'core' },
  { id: 'surprised.confused.disillusioned', valence: 2, energy: 2, tier: 'extended' },
  { id: 'surprised.confused.perplexed', valence: 3, energy: 3, tier: 'extended' },
  { id: 'surprised.amazed', valence: 4, energy: 4, tier: 'core' },
  { id: 'surprised.amazed.astonished', valence: 4, energy: 5, tier: 'extended' },
  { id: 'surprised.amazed.awestruck', valence: 5, energy: 3, tier: 'extended' },
  { id: 'surprised.excited', valence: 5, energy: 5, tier: 'core' },
  { id: 'surprised.excited.eager', valence: 5, energy: 5, tier: 'extended' },
  { id: 'surprised.excited.energized', valence: 5, energy: 5, tier: 'extended' },

  { id: 'bad.bored', valence: 2, energy: 1, tier: 'core' },
  { id: 'bad.bored.indifferent', valence: 2, energy: 1, tier: 'extended' },
  { id: 'bad.bored.apathetic', valence: 2, energy: 1, tier: 'extended' },
  { id: 'bad.busy', valence: 2, energy: 4, tier: 'core' },
  { id: 'bad.busy.pressured', valence: 2, energy: 4, tier: 'extended' },
  { id: 'bad.busy.rushed', valence: 2, energy: 5, tier: 'extended' },
  { id: 'bad.stressed', valence: 2, energy: 4, tier: 'core' },
  { id: 'bad.stressed.overwhelmed', valence: 1, energy: 5, tier: 'extended' },
  { id: 'bad.stressed.out_of_control', valence: 1, energy: 5, tier: 'extended' },
  { id: 'bad.tired', valence: 2, energy: 2, tier: 'core' },
  { id: 'bad.tired.sleepy', valence: 3, energy: 1, tier: 'extended' },
  { id: 'bad.tired.unfocused', valence: 2, energy: 2, tier: 'extended' },
  { id: 'bad.tired.drained', valence: 1, energy: 1, tier: 'extended' },

  { id: 'fearful.scared', valence: 2, energy: 5, tier: 'core' },
  { id: 'fearful.scared.helpless', valence: 1, energy: 2, tier: 'extended' },
  { id: 'fearful.scared.frightened', valence: 1, energy: 5, tier: 'extended' },
  { id: 'fearful.anxious', valence: 2, energy: 4, tier: 'core' },
  { id: 'fearful.anxious.worried', valence: 2, energy: 3, tier: 'extended' },
  { id: 'fearful.anxious.nervous', valence: 2, energy: 4, tier: 'extended' },
  { id: 'fearful.insecure', valence: 2, energy: 2, tier: 'core' },
  { id: 'fearful.insecure.inadequate', valence: 1, energy: 2, tier: 'sensitive' },
  { id: 'fearful.insecure.inferior', valence: 1, energy: 2, tier: 'sensitive' },
  { id: 'fearful.weak', valence: 2, energy: 2, tier: 'core' },
  { id: 'fearful.weak.worthless', valence: 1, energy: 1, tier: 'sensitive' },
  { id: 'fearful.weak.insignificant', valence: 1, energy: 1, tier: 'sensitive' },
  { id: 'fearful.rejected', valence: 1, energy: 2, tier: 'core' },
  { id: 'fearful.rejected.excluded', valence: 1, energy: 2, tier: 'extended' },
  { id: 'fearful.rejected.persecuted', valence: 1, energy: 3, tier: 'sensitive' },
  { id: 'fearful.threatened', valence: 2, energy: 5, tier: 'core' },
  { id: 'fearful.threatened.exposed', valence: 2, energy: 4, tier: 'extended' },
  { id: 'fearful.threatened.cornered', valence: 1, energy: 5, tier: 'extended' },

  { id: 'angry.let_down', valence: 2, energy: 2, tier: 'core' },
  { id: 'angry.let_down.betrayed', valence: 1, energy: 3, tier: 'extended' },
  { id: 'angry.let_down.resentful', valence: 2, energy: 3, tier: 'extended' },
  { id: 'angry.humiliated', valence: 1, energy: 3, tier: 'core' },
  { id: 'angry.humiliated.disrespected', valence: 2, energy: 4, tier: 'extended' },
  { id: 'angry.humiliated.ridiculed', valence: 1, energy: 3, tier: 'extended' },
  { id: 'angry.mad', valence: 1, energy: 5, tier: 'core' },
  { id: 'angry.mad.furious', valence: 1, energy: 5, tier: 'extended' },
  { id: 'angry.mad.jealous', valence: 2, energy: 4, tier: 'extended' },
  { id: 'angry.frustrated', valence: 2, energy: 4, tier: 'core' },
  { id: 'angry.frustrated.annoyed', valence: 3, energy: 3, tier: 'extended' },
  { id: 'angry.frustrated.infuriated', valence: 1, energy: 5, tier: 'extended' },
  { id: 'angry.distant', valence: 2, energy: 1, tier: 'core' },
  { id: 'angry.distant.withdrawn', valence: 2, energy: 1, tier: 'extended' },
  { id: 'angry.distant.numb', valence: 1, energy: 1, tier: 'sensitive' },
  { id: 'angry.critical', valence: 2, energy: 3, tier: 'core' },
  { id: 'angry.critical.skeptical', valence: 3, energy: 3, tier: 'extended' },
  { id: 'angry.critical.dismissive', valence: 2, energy: 3, tier: 'extended' },

  { id: 'disgusted.disapproving', valence: 2, energy: 3, tier: 'core' },
  { id: 'disgusted.disapproving.judgmental', valence: 2, energy: 3, tier: 'extended' },
  { id: 'disgusted.disapproving.embarrassed', valence: 2, energy: 3, tier: 'extended' },
  { id: 'disgusted.disappointed', valence: 2, energy: 2, tier: 'core' },
  { id: 'disgusted.disappointed.appalled', valence: 1, energy: 5, tier: 'extended' },
  { id: 'disgusted.disappointed.revolted', valence: 1, energy: 5, tier: 'extended' },
  { id: 'disgusted.awful', valence: 1, energy: 2, tier: 'core' },
  { id: 'disgusted.awful.nauseated', valence: 1, energy: 2, tier: 'extended' },
  { id: 'disgusted.awful.detestable', valence: 1, energy: 3, tier: 'sensitive' },
  { id: 'disgusted.repelled', valence: 2, energy: 4, tier: 'core' },
  { id: 'disgusted.repelled.horrified', valence: 1, energy: 5, tier: 'extended' },
  { id: 'disgusted.repelled.hesitant', valence: 3, energy: 2, tier: 'extended' },

  { id: 'sad.lonely', valence: 1, energy: 1, tier: 'core' },
  { id: 'sad.lonely.isolated', valence: 1, energy: 1, tier: 'extended' },
  { id: 'sad.lonely.abandoned', valence: 1, energy: 2, tier: 'sensitive' },
  { id: 'sad.vulnerable', valence: 2, energy: 2, tier: 'core' },
  { id: 'sad.vulnerable.fragile', valence: 2, energy: 2, tier: 'extended' },
  { id: 'sad.vulnerable.victimized', valence: 1, energy: 2, tier: 'sensitive' },
  { id: 'sad.despair', valence: 1, energy: 1, tier: 'core' },
  { id: 'sad.despair.grief', valence: 1, energy: 2, tier: 'extended' },
  { id: 'sad.despair.powerless', valence: 1, energy: 1, tier: 'sensitive' },
  { id: 'sad.guilty', valence: 1, energy: 2, tier: 'core' },
  { id: 'sad.guilty.remorseful', valence: 2, energy: 2, tier: 'extended' },
  { id: 'sad.guilty.ashamed', valence: 1, energy: 2, tier: 'sensitive' },
  { id: 'sad.depressed', valence: 1, energy: 1, tier: 'sensitive' },
  { id: 'sad.depressed.empty', valence: 1, energy: 1, tier: 'sensitive' },
  { id: 'sad.depressed.hopeless', valence: 1, energy: 1, tier: 'sensitive' },
  { id: 'sad.hurt', valence: 1, energy: 2, tier: 'core' },
  { id: 'sad.hurt.disappointed', valence: 2, energy: 2, tier: 'extended' },
  { id: 'sad.hurt.embarrassed', valence: 2, energy: 3, tier: 'extended' },

  { id: 'compound.money_anxiety', valence: 2, energy: 4, tier: 'core' },
  { id: 'compound.deadline_pressure', valence: 2, energy: 4, tier: 'core' },
  { id: 'compound.awaiting', valence: 3, energy: 3, tier: 'core' },
  { id: 'compound.good_tired', valence: 4, energy: 2, tier: 'core' },
  { id: 'compound.relief_after_effort', valence: 4, energy: 2, tier: 'core' },
  { id: 'compound.burnout', valence: 1, energy: 1, tier: 'core' },
  { id: 'compound.social_battery_empty', valence: 2, energy: 1, tier: 'core' },
  { id: 'compound.homesick', valence: 2, energy: 2, tier: 'core' },
];

export function createEmotionVocabulary(): EmotionVocabulary {
  return EmotionVocabulary.create(EMOTION_VOCABULARY_DATA);
}
