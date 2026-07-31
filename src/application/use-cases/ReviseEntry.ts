import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { EntryEdits, MoodEntry } from '../../domain/entities/MoodEntry';

/** Applies the user's corrections to a draft. Still nothing is stored. */
export class ReviseEntry {
  constructor(private readonly vocabulary: EmotionVocabulary) {}

  execute(entry: MoodEntry, edits: EntryEdits): MoodEntry {
    if (edits.emotionIds === undefined) {
      return entry.reviseWith(edits);
    }

    // The user picked from the wheel by hand, so the choice is exact: no depth
    // lifting and no sensitive-tier filter, both of which only restrain Luna.
    return entry.reviseWith({
      ...edits,
      emotionIds: this.vocabulary.keepKnown(edits.emotionIds),
    });
  }
}
