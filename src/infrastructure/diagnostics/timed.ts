import type Anthropic from '@anthropic-ai/sdk';

import type { IReflectionAnalyzer, ReflectionProposal } from '../../domain/ports/IReflectionAnalyzer';
import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';
import type { MessagesClient } from '../analysis/claudeModels';

/** Where a stage timing goes. Injected so a test can read it without a console. */
export type ReportTiming = (stage: string, ms: number) => void;

export const logTiming: ReportTiming = (stage, ms) => {
  /*
   * log, not warn. React Native routes warnings into LogBox, which swallows
   * them once its overlay appears — the timings simply stopped reaching Metro
   * halfway through a measuring session. The lint rule prefers warn; a timing
   * line is not a warning, and being readable is the whole point of it.
   */
  // eslint-disable-next-line no-console
  console.log(`[luna] ${stage} ${Math.round(ms)}ms`);
};

async function timed<T>(
  stage: string,
  report: ReportTiming,
  work: () => Promise<T>,
): Promise<T> {
  const started = Date.now();

  try {
    return await work();
  } finally {
    report(stage, Date.now() - started);
  }
}

/**
 * Wrappers rather than timing inside the adapters, so measurement is something
 * the composition root switches on and the adapters never carry.
 *
 * Capture-to-save is M4's completion criterion and it came in at thirteen
 * seconds after the stop, against a budget of ten for the whole interaction.
 * Three stages could own that time and guessing between them is how the wrong
 * one gets optimised.
 */
export class TimedTranscriptionService implements ITranscriptionService {
  constructor(
    private readonly inner: ITranscriptionService,
    private readonly report: ReportTiming = logTiming,
  ) {}

  transcribe(recording: AudioRecording): Promise<TranscriptionResult> {
    return timed(`transcribe (${Math.round(recording.durationMs / 100) / 10}s of audio)`, this.report, () =>
      this.inner.transcribe(recording),
    );
  }
}

export class TimedReflectionAnalyzer implements IReflectionAnalyzer {
  constructor(
    private readonly inner: IReflectionAnalyzer,
    private readonly report: ReportTiming = logTiming,
  ) {}

  analyze(transcript: string): Promise<ReflectionProposal> {
    return timed('analyze', this.report, () => this.inner.analyze(transcript));
  }
}

/**
 * The two calls behind `analyze` run together, so timing the use case only
 * shows the slower one. This says which.
 */
export class TimedMessagesClient implements MessagesClient {
  constructor(
    private readonly inner: MessagesClient,
    private readonly report: ReportTiming = logTiming,
  ) {}

  create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    return timed(params.model, this.report, () => this.inner.create(params));
  }
}
