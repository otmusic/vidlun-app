import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { IClock } from '../../domain/ports/IClock';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { IReflectionAnalyzer } from '../../domain/ports/IReflectionAnalyzer';
import type { VoiceCue } from '../../domain/value-objects/VoiceCue';
import { readingFromProposal, type Reading } from './draftFromProposal';
import type { Spoken } from './TranscribeTake';

/**
 * Turns spoken words into a draft, and the words the card offers beside it.
 * Nothing is stored: the reflection card is a proposal, and only
 * `ConfirmEntry` writes.
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

  /** `voice` is how the take sounded against the person's usual voice, when that is known. */
  async execute(spoken: Spoken, at?: Date, voice: VoiceCue | null = null): Promise<Reading> {
    return readingFromProposal({
      id: this.idGenerator.next(),
      /*
       * Yesterday, when the person is filling the day they missed; now
       * otherwise. The entry belongs to the day it speaks about.
       */
      createdAt: at ?? this.clock.now(),
      source: 'voice',
      rawTranscript: spoken.text,
      confidence: spoken.confidence,
      proposal: await this.analyzer.analyze(spoken.text, voice),
      vocabulary: this.vocabulary,
    });
  }
}
