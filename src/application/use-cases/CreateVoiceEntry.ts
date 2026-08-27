import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IClock } from '../../domain/ports/IClock';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { IReflectionAnalyzer } from '../../domain/ports/IReflectionAnalyzer';
import { draftFromProposal } from './draftFromProposal';
import type { Spoken } from './TranscribeTake';

/**
 * Turns spoken words into a draft. Nothing is stored: the reflection card is a
 * proposal, and only `ConfirmEntry` writes.
 *
 * It takes a transcript rather than a recording because `TranscribeTake` runs
 * first and separately — the card is already asking its question by the time
 * this starts.
 */
export class CreateVoiceEntry {
  constructor(
    private readonly analyzer: IReflectionAnalyzer,
    private readonly vocabulary: EmotionVocabulary,
    private readonly clock: IClock,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(spoken: Spoken): Promise<MoodEntry> {
    return draftFromProposal({
      id: this.idGenerator.next(),
      createdAt: this.clock.now(),
      source: 'voice',
      rawTranscript: spoken.text,
      confidence: spoken.confidence,
      proposal: await this.analyzer.analyze(spoken.text),
      vocabulary: this.vocabulary,
    });
  }
}
