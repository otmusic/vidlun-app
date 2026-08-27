import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { NothingWasSaidError } from '../../domain/errors/MoodEntryErrors';
import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type { IClock } from '../../domain/ports/IClock';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { IReflectionAnalyzer } from '../../domain/ports/IReflectionAnalyzer';
import type { ITranscriptionService } from '../../domain/ports/ITranscriptionService';
import { Confidence } from '../../domain/value-objects/Confidence';
import { draftFromProposal } from './draftFromProposal';

/**
 * Turns a finished recording into a draft. Nothing is stored: the reflection
 * card is a proposal, and only `ConfirmEntry` writes.
 *
 * The recording itself is started and stopped by the screen: when a take ends
 * is the person's call, not this use case's.
 */
export class CreateVoiceEntry {
  constructor(
    private readonly transcription: ITranscriptionService,
    private readonly analyzer: IReflectionAnalyzer,
    private readonly vocabulary: EmotionVocabulary,
    private readonly clock: IClock,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(recording: AudioRecording): Promise<MoodEntry> {
    const transcription = await this.transcription.transcribe(recording);
    const spoken = transcription.text.trim();

    if (spoken.length === 0) {
      throw new NothingWasSaidError();
    }

    const confidence = Confidence.clamped(transcription.confidence);

    return draftFromProposal({
      id: this.idGenerator.next(),
      createdAt: this.clock.now(),
      source: 'voice',
      rawTranscript: spoken,
      confidence,
      proposal: await this.analyzer.analyze(spoken),
      vocabulary: this.vocabulary,
    });
  }
}
