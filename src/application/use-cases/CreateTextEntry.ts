import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { NothingWasSaidError } from '../../domain/errors/MoodEntryErrors';
import type { IClock } from '../../domain/ports/IClock';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { IReflectionAnalyzer } from '../../domain/ports/IReflectionAnalyzer';
import { Confidence } from '../../domain/value-objects/Confidence';
import { draftFromProposal } from './draftFromProposal';

/**
 * The fallback for someone who cannot speak right now. Confidence is full:
 * a human typed the words, so nothing was heard and nothing was misheard,
 * and Luna may be as specific as the wheel allows.
 */
export class CreateTextEntry {
  constructor(
    private readonly analyzer: IReflectionAnalyzer,
    private readonly vocabulary: EmotionVocabulary,
    private readonly clock: IClock,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(text: string): Promise<MoodEntry> {
    const typed = text.trim();

    if (typed.length === 0) {
      throw new NothingWasSaidError();
    }

    return draftFromProposal({
      id: this.idGenerator.next(),
      createdAt: this.clock.now(),
      source: 'text',
      rawTranscript: typed,
      confidence: Confidence.of(1),
      proposal: await this.analyzer.analyze(typed),
      vocabulary: this.vocabulary,
    });
  }
}
