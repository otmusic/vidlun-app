import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IMoodEntryRepository } from '../../domain/ports/IMoodEntryRepository';
import type { IReflectionAnalyzer } from '../../domain/ports/IReflectionAnalyzer';
import type { IUnheardEntries } from '../../domain/ports/IUnheardEntries';
import { draftFromProposal } from './draftFromProposal';

/**
 * Listens, late, to the entries saved while Vidlun could not. Runs when the
 * app opens or comes back to the front, oldest first, and stops at the first
 * entry the network will not carry: the rest wait for the next chance.
 *
 * What was the person's stays the person's. Their words, their corrected
 * transcript, a mood they set, tags they wrote — none of it is overwritten by
 * an answer that arrived a day late. Vidlun's answer fills the gaps and takes
 * its usual place beside theirs as the proposal, so the journal shows what it
 * would have shown had the network been there.
 */
export class HearUnheardEntries {
  private running: Promise<number> | null = null;

  constructor(
    private readonly unheard: IUnheardEntries,
    private readonly repository: IMoodEntryRepository,
    private readonly analyzer: IReflectionAnalyzer,
    private readonly vocabulary: EmotionVocabulary,
  ) {}

  /** Resolves with how many entries were heard. A second call joins the first. */
  execute(): Promise<number> {
    this.running ??= this.hear().finally(() => {
      this.running = null;
    });

    return this.running;
  }

  private async hear(): Promise<number> {
    let heard = 0;

    for (const id of await this.unheard.ids()) {
      const entry = await this.repository.findById(id);

      // Deleted in the meantime: nothing left to hear.
      if (entry === null) {
        await this.unheard.remove(id);
        continue;
      }

      let proposal;

      try {
        proposal = await this.analyzer.analyze(entry.rawTranscript);
      } catch {
        return heard;
      }

      const answer = draftFromProposal({
        id: entry.id,
        createdAt: entry.createdAt,
        source: entry.source,
        rawTranscript: entry.rawTranscript,
        confidence: entry.confidence,
        proposal,
        vocabulary: this.vocabulary,
      });

      await this.repository.save(merged(entry, answer));
      await this.unheard.remove(id);
      heard += 1;
    }

    return heard;
  }
}

/** Vidlun's late answer laid under what the person already put there. */
function merged(kept: MoodEntry, answer: MoodEntry): MoodEntry {
  const personAnswered = kept.selfEmotionIds.length > 0 || kept.wasRevisedByUser;

  return MoodEntry.create({
    ...kept.toProps(),
    cleanTranscript: kept.wasRevisedByUser ? kept.cleanTranscript : answer.cleanTranscript,
    mood: kept.mood ?? answer.mood,
    emotionIds: personAnswered ? kept.emotionIds : answer.emotionIds,
    proposedEmotionIds: answer.emotionIds,
    contextTags: kept.contextTags.length > 0 ? kept.contextTags : answer.contextTags,
    safetyFlag: answer.safetyFlag,
  });
}
