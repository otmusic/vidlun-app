import type Anthropic from '@anthropic-ai/sdk';
import type { NativeRecorder } from '@/infrastructure/audio/ExpoAudioRecorder';
import type { MessagesClient } from '@/infrastructure/analysis/claudeModels';
import type { IKeyValueStore } from '@/infrastructure/persistence/IKeyValueStore';
import type { IScheduler } from '@/infrastructure/system/IScheduler';
import type {
  NotificationCenter,
  NotificationKind,
  NotificationText,
} from '@/infrastructure/system/NotificationCenter';

export class InMemoryKeyValueStore implements IKeyValueStore {
  private readonly entries = new Map<string, string>();

  getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.entries.get(key) ?? null);
  }

  setItem(key: string, value: string): Promise<void> {
    this.entries.set(key, value);

    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    this.entries.delete(key);

    return Promise.resolve();
  }

  getAllKeys(): Promise<readonly string[]> {
    return Promise.resolve([...this.entries.keys()]);
  }

  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]> {
    return Promise.resolve(keys.map((key) => [key, this.entries.get(key) ?? null] as const));
  }

  /** Lets a test plant a record the app could never have written. */
  poison(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

export class ManualScheduler implements IScheduler {
  private ticks: (() => void)[] = [];

  every(_intervalMs: number, tick: () => void): () => void {
    this.ticks.push(tick);

    return () => {
      this.ticks = this.ticks.filter((candidate) => candidate !== tick);
    };
  }

  advance(times = 1): void {
    for (let count = 0; count < times; count += 1) {
      for (const tick of [...this.ticks]) {
        tick();
      }
    }
  }

  get watching(): number {
    return this.ticks.length;
  }
}

export class FakeNativeRecorder implements NativeRecorder {
  uri: string | null = 'file:///take.m4a';
  prepareCalls = 0;
  pauseCalls = 0;
  stopCalls = 0;
  stopFailure: Error | null = null;
  /** Lets a test observe when preparing happens relative to the audio session. */
  onPrepare: (() => void) | null = null;

  private durationMillis = 0;
  private isRecording = false;
  private metering: number | undefined = undefined;

  prepareToRecordAsync(): Promise<void> {
    this.prepareCalls += 1;
    this.onPrepare?.();

    return Promise.resolve();
  }

  record(): void {
    this.isRecording = true;
  }

  pause(): void {
    this.pauseCalls += 1;
    this.isRecording = false;
  }

  stop(): Promise<void> {
    this.stopCalls += 1;
    this.isRecording = false;

    return this.stopFailure === null ? Promise.resolve() : Promise.reject(this.stopFailure);
  }

  getStatus(): { durationMillis: number; isRecording: boolean; metering?: number } {
    return {
      durationMillis: this.durationMillis,
      isRecording: this.isRecording,
      ...(this.metering === undefined ? {} : { metering: this.metering }),
    };
  }

  /**
   * Moves the take forward by one poll interval at the given loudness. A
   * paused take does not grow, as expo-audio's own duration does not.
   */
  emit(metering: number | undefined, elapsedMs: number): void {
    this.metering = metering;

    if (this.isRecording) {
      this.durationMillis += elapsedMs;
    }
  }
}

export class FakeMessagesClient implements MessagesClient {
  readonly requests: Anthropic.MessageCreateParamsNonStreaming[] = [];

  private readonly byModel = new Map<string, Partial<Anthropic.Message>>();

  constructor(private readonly reply: Partial<Anthropic.Message>) {}

  /** Lets a test answer the classification and the observation differently. */
  answering(model: string, reply: Partial<Anthropic.Message>): this {
    this.byModel.set(model, reply);

    return this;
  }

  requestTo(model: string): Anthropic.MessageCreateParamsNonStreaming | undefined {
    return this.requests.find((request) => request.model === model);
  }

  create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    this.requests.push(params);

    return Promise.resolve({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5',
      content: [],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
      ...(this.byModel.get(params.model) ?? this.reply),
    } as Anthropic.Message);
  }
}

export function textReply(text: string): Partial<Anthropic.Message> {
  return { content: [{ type: 'text', text, citations: null }] as Anthropic.ContentBlock[] };
}

/**
 * The phone's notifications as two lists, with every call taking a tick the
 * way the native bridge does — which is what lets two plans interleave.
 */
export class FakeNotificationCenter implements NotificationCenter {
  pending: Date[] = [];
  /** The affirmation mornings scheduled, in order. */
  affirmations: Date[] = [];
  /** What each scheduled notification said, in the order they were scheduled. */
  texts: NotificationText[] = [];
  allows = true;

  async granted(): Promise<boolean> {
    await Promise.resolve();

    return this.allows;
  }

  async cancel(kind: NotificationKind): Promise<void> {
    await Promise.resolve();

    if (kind === 'reminder') {
      this.pending = [];
    } else {
      this.affirmations = [];
    }
  }

  async scheduleAt(date: Date, text: NotificationText): Promise<void> {
    await Promise.resolve();
    this.pending.push(date);
    this.texts.push(text);
  }

  async scheduleAffirmation(date: Date, text: NotificationText): Promise<void> {
    await Promise.resolve();
    this.affirmations.push(date);
    this.texts.push(text);
  }
}

