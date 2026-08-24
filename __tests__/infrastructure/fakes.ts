import type Anthropic from '@anthropic-ai/sdk';
import type { NativeRecorder } from '@/infrastructure/audio/ExpoAudioRecorder';
import type { MessagesClient } from '@/infrastructure/analysis/claudeModels';
import type { IKeyValueStore } from '@/infrastructure/persistence/IKeyValueStore';
import type { IScheduler } from '@/infrastructure/system/IScheduler';

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

  /** Moves the take forward by one poll interval at the given loudness. */
  emit(metering: number | undefined, elapsedMs: number): void {
    this.metering = metering;
    this.durationMillis += elapsedMs;
  }
}

export class FakeMessagesClient implements MessagesClient {
  readonly requests: Anthropic.MessageCreateParamsNonStreaming[] = [];

  constructor(private readonly reply: Partial<Anthropic.Message>) {}

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
      ...this.reply,
    } as Anthropic.Message);
  }
}

export function textReply(text: string): Partial<Anthropic.Message> {
  return { content: [{ type: 'text', text, citations: null }] as Anthropic.ContentBlock[] };
}
