import { MoodEntry, type EntrySource } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { Spoken } from './TranscribeTake';

/**
 * The draft for words Vidlun could not listen to: the transcript as it was
 * heard, no mood, no words of Vidlun's, nothing cleaned up. The person's own
 * answer goes in on top, and `HearUnheardEntries` fills the rest in later.
 *
 * Nothing is stored here either — `ConfirmEntry` writes, as always.
 */
export class CreateUnheardEntry {
  constructor(
    private readonly clock: IClock,
    private readonly idGenerator: IIdGenerator,
  ) {}

  execute(spoken: Spoken, source: EntrySource, at?: Date): MoodEntry {
    return MoodEntry.create({
      id: this.idGenerator.next(),
      createdAt: at ?? this.clock.now(),
      source,
      rawTranscript: spoken.text,
      cleanTranscript: spoken.text,
      mood: null,
      emotionIds: [],
      proposedEmotionIds: [],
      contextTags: [],
      observation: null,
      confidence: spoken.confidence,
      safetyFlag: 'none',
    });
  }
}
