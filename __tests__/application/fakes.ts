import type { IRecordingStore } from '@/domain/ports/IRecordingStore';
import type { MoodEntry } from '@/domain/entities/MoodEntry';
import type { AudioRecording } from '@/domain/ports/IAudioRecorder';
import type { IClock } from '@/domain/ports/IClock';
import type { IIdGenerator } from '@/domain/ports/IIdGenerator';
import type { INarrativeGenerator } from '@/domain/ports/INarrativeGenerator';
import type { IReflectionAnalyzer, ReflectionProposal } from '@/domain/ports/IReflectionAnalyzer';
import type { DisagreementRecord, EntryRevisionRecord, IRevisionLog } from '@/domain/ports/IRevisionLog';
import type { ITranscriptionService, TranscriptionResult } from '@/domain/ports/ITranscriptionService';

export const RECORDING: AudioRecording = { uri: 'file:///take.m4a', durationMs: 4200 };

export class FixedClock implements IClock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(moment: Date): void {
    this.current = moment;
  }
}

export class SequentialIdGenerator implements IIdGenerator {
  private issued = 0;

  next(): string {
    this.issued += 1;

    return `entry-${this.issued}`;
  }
}

export class StubTranscriptionService implements ITranscriptionService {
  readonly received: AudioRecording[] = [];

  constructor(private readonly result: TranscriptionResult) {}

  prepared = 0;

  prepare(): Promise<void> {
    this.prepared += 1;

    return Promise.resolve();
  }

  transcribe(recording: AudioRecording): Promise<TranscriptionResult> {
    this.received.push(recording);

    return Promise.resolve(this.result);
  }
}

export class StubReflectionAnalyzer implements IReflectionAnalyzer {
  readonly received: string[] = [];

  constructor(private readonly proposal: ReflectionProposal) {}

  analyze(transcript: string): Promise<ReflectionProposal> {
    this.received.push(transcript);

    return Promise.resolve(this.proposal);
  }
}

export class StubNarrativeGenerator implements INarrativeGenerator {
  readonly calls: (readonly MoodEntry[])[] = [];

  constructor(private readonly narrative = 'Calmer mornings, tense evenings.') {}

  generate(entries: readonly MoodEntry[]): Promise<string> {
    this.calls.push(entries);

    return Promise.resolve(this.narrative);
  }
}

export class RecordingRevisionLog implements IRevisionLog {
  readonly records: EntryRevisionRecord[] = [];
  readonly disagreements: DisagreementRecord[] = [];
  readonly forgotten: string[] = [];

  record(revision: EntryRevisionRecord): Promise<void> {
    this.records.push(revision);

    return Promise.resolve();
  }

  disagree(disagreement: DisagreementRecord): Promise<void> {
    this.disagreements.push(disagreement);

    return Promise.resolve();
  }

  forget(entryId: string): Promise<void> {
    this.forgotten.push(entryId);

    for (const kept of [this.records, this.disagreements]) {
      for (let i = kept.length - 1; i >= 0; i -= 1) {
        if (kept[i]?.entryId === entryId) {
          kept.splice(i, 1);
        }
      }
    }

    return Promise.resolve();
  }
}

export function proposal(overrides: Partial<ReflectionProposal> = {}): ReflectionProposal {
  return {
    cleanTranscript: 'Finished three tasks, happy, but very tired.',
    mood: 4,
    emotionIds: [],
    contextTags: [],
    safetyFlag: 'none',
    ...overrides,
  };
}

export class InMemoryRecordingStore implements IRecordingStore {
  readonly kept = new Map<string, string>();
  readonly discarded: string[] = [];
  sweptBefore: Date | null = null;
  failOnKeep = false;

  keep(entryId: string, sourceUri: string): Promise<void> {
    if (this.failOnKeep) {
      return Promise.reject(new Error('no space'));
    }

    this.kept.set(entryId, sourceUri);

    return Promise.resolve();
  }

  discard(entryId: string): Promise<void> {
    this.discarded.push(entryId);
    this.kept.delete(entryId);

    return Promise.resolve();
  }

  discardBefore(cutoff: Date): Promise<void> {
    this.sweptBefore = cutoff;

    return Promise.resolve();
  }

  find(entryId: string): Promise<string | null> {
    return Promise.resolve(this.kept.get(entryId) ?? null);
  }
}
