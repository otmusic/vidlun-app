import type Anthropic from '@anthropic-ai/sdk';

import type { IReflectionAnalyzer, ReflectionProposal } from '../../domain/ports/IReflectionAnalyzer';
import type { AudioRecording } from '../../domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '../../domain/ports/ITranscriptionService';
import type {
  IPurchases,
  PurchaseOutcome,
  SubscriptionStatus,
} from '../../domain/ports/IPurchases';
import type { MessagesClient } from '../analysis/claudeModels';

/** Where a stage timing goes. Injected so a test can read it without a console. */
export type ReportTiming = (stage: string, ms: number) => void;

/** Where the words go, for as long as it takes to tell two rewriters apart. */
export type ReportTranscript = (text: string) => void;

/**
 * The card shows `cleanTranscript`, which has been through the analyzer's
 * repair prompt. So a wrong word on screen has two possible authors and no
 * way to tell which: the recogniser mishearing, or the repair "fixing" what
 * was heard correctly. This prints what the recogniser actually returned.
 *
 * Development only, and it puts someone's own sentence in the terminal — it
 * comes out again once §1e's attribution question is settled.
 */
export const logTranscript: ReportTranscript = (text) => {
  // eslint-disable-next-line no-console
  console.log(`[vidlun] heard: ${text}`);
};

/** The other half of the same question: what the repair prompt made of it. */
export const logRepair: ReportTranscript = (text) => {
  // eslint-disable-next-line no-console
  console.log(`[vidlun] repaired: ${text}`);
};

export const logTiming: ReportTiming = (stage, ms) => {
  /*
   * log, not warn. React Native routes warnings into LogBox, which swallows
   * them once its overlay appears — the timings simply stopped reaching Metro
   * halfway through a measuring session. The lint rule prefers warn; a timing
   * line is not a warning, and being readable is the whole point of it.
   */
  // eslint-disable-next-line no-console
  console.log(`[vidlun] ${stage} ${Math.round(ms)}ms`);
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
    private readonly reportTranscript: ReportTranscript = logTranscript,
  ) {}

  prepare(): Promise<void> {
    return timed('open model', this.report, () => this.inner.prepare());
  }

  async transcribe(recording: AudioRecording): Promise<TranscriptionResult> {
    const result = await timed(
      `transcribe (${Math.round(recording.durationMs / 100) / 10}s of audio)`,
      this.report,
      () => this.inner.transcribe(recording),
    );

    this.reportTranscript(result.text);

    return result;
  }
}

export class TimedReflectionAnalyzer implements IReflectionAnalyzer {
  constructor(
    private readonly inner: IReflectionAnalyzer,
    private readonly report: ReportTiming = logTiming,
    private readonly reportTranscript: ReportTranscript = logRepair,
  ) {}

  async analyze(transcript: string): Promise<ReflectionProposal> {
    const proposal = await timed('analyze', this.report, () => this.inner.analyze(transcript));

    this.reportTranscript(proposal.cleanTranscript);

    return proposal;
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

/**
 * What the store answered, and why, while the paywall is being wired.
 *
 * A purchase fails in a dozen ways that all look the same from the screen —
 * no product, wrong entitlement id, sandbox account not signed in — and the
 * difference is only ever in the error the SDK threw.
 */
export class TimedPurchases implements IPurchases {
  constructor(
    private readonly inner: IPurchases,
    private readonly report: ReportTiming = logTiming,
  ) {}

  async status(): Promise<SubscriptionStatus> {
    const status = await timed('store status', this.report, () => this.inner.status());

    // eslint-disable-next-line no-console
    console.log(`[vidlun] store says active=${String(status.active)}`);

    return status;
  }

  async subscribe(): Promise<PurchaseOutcome> {
    return this.announce('subscribe', () => this.inner.subscribe());
  }

  async restore(): Promise<PurchaseOutcome> {
    return this.announce('restore', () => this.inner.restore());
  }

  private async announce(
    what: string,
    work: () => Promise<PurchaseOutcome>,
  ): Promise<PurchaseOutcome> {
    const outcome = await timed(what, this.report, work);

    // eslint-disable-next-line no-console
    console.log(`[vidlun] ${what} -> ${outcome}`);

    return outcome;
  }
}
