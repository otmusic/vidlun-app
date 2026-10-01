import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { EntryEdits, MoodEntry } from '../../domain/entities/MoodEntry';
import { isOwnWord } from '../../domain/entities/OwnWord';

/** Applies the user's corrections to a draft. Still nothing is stored. */
export class ReviseEntry {
  constructor(private readonly vocabulary: EmotionVocabulary) {}

  execute(entry: MoodEntry, edits: EntryEdits): MoodEntry {
    if (edits.emotionIds === undefined) {
      return entry.reviseWith(edits);
    }

    // The user picked from the wheel by hand, so the choice is exact: no depth
    // lifting and no sensitive-tier filter, both of which only restrain Vidlun.
    // A word they typed themselves is theirs and stays; only an id nobody
    // could have picked is dropped.
    return entry.reviseWith({
      ...edits,
      emotionIds: edits.emotionIds.filter((id) => isOwnWord(id) || this.vocabulary.has(id)),
    });
  }
}
