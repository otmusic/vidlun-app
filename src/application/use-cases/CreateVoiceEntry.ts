import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import { MoodEntry } from '../../domain/entities/MoodEntry';
import { NothingWasSaidError } from '../../domain/errors/MoodEntryErrors';
import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type { IClock } from '../../domain/ports/IClock';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { IReflectionAnalyzer } from '../../domain/ports/IReflectionAnalyzer';
import type { ITranscriptionService } from '../../domain/ports/ITranscriptionService';
import { Confidence } from '../../domain/value-objects/Confidence';
import { MoodScore } from '../../domain/value-objects/MoodScore';

/**
 * Turns a finished recording into a draft. Nothing is stored: the reflection
 * card is a proposal, and only `ConfirmEntry` writes.
 *
 * The recording itself is started and stopped by the screen, because auto-stop
 * on silence is a capture-speed decision rather than a product rule.
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
    const proposal = await this.analyzer.analyze(spoken);
    const cleaned = proposal.cleanTranscript.trim();

    return MoodEntry.create({
      id: this.idGenerator.next(),
      createdAt: this.clock.now(),
      source: 'voice',
      rawTranscript: spoken,
      // A model that returns an empty cleanup must not cost the user the entry.
      cleanTranscript: cleaned.length > 0 ? cleaned : spoken,
      mood: MoodScore.clamped(proposal.mood),
      emotionIds: this.vocabulary.normalizeAiProposal(proposal.emotionIds, {
        maxDepth: confidence.maxEmotionDepth,
        limit: MoodEntry.MAX_EMOTIONS,
      }),
      contextTags: proposal.contextTags,
      observation: proposal.observation,
      confidence,
      safetyFlag: proposal.safetyFlag,
    });
  }
}
