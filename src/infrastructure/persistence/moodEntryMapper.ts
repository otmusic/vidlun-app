import { MoodEntry, type EntrySource, type SafetyFlag } from '../../domain/entities/MoodEntry';
import { DomainError } from '../../domain/errors/DomainError';
import { Confidence } from '../../domain/value-objects/Confidence';
import { MoodScore } from '../../domain/value-objects/MoodScore';

export class CorruptStoredEntryError extends DomainError {
  constructor(field: string) {
    super(`Stored entry is unreadable: "${field}" is missing or the wrong type.`);
  }
}

export interface StoredMoodEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly source: EntrySource;
  readonly rawTranscript: string;
  readonly cleanTranscript: string;
  /** Null on an entry that never said how the day was. */
  readonly mood: number | null;
  readonly emotionIds: readonly string[];
  readonly selfEmotionIds: readonly string[];
  readonly proposedEmotionIds: readonly string[];
  readonly contextTags: readonly string[];
  readonly observation: string | null;
  readonly confidence: number;
  readonly safetyFlag: SafetyFlag;
  readonly wasRevisedByUser: boolean;
}

const SOURCES: readonly EntrySource[] = ['voice', 'text'];
const SAFETY_FLAGS: readonly SafetyFlag[] = ['none', 'distress', 'crisis'];

export function toStored(entry: MoodEntry): StoredMoodEntry {
  return {
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    source: entry.source,
    rawTranscript: entry.rawTranscript,
    cleanTranscript: entry.cleanTranscript,
    mood: entry.mood === null ? null : entry.mood.value,
    emotionIds: [...entry.emotionIds],
    selfEmotionIds: [...entry.selfEmotionIds],
    proposedEmotionIds: [...entry.proposedEmotionIds],
    contextTags: [...entry.contextTags],
    observation: entry.observation,
    confidence: entry.confidence.value,
    safetyFlag: entry.safetyFlag,
    wasRevisedByUser: entry.wasRevisedByUser,
  };
}

/**
 * Strict on the way in: an entry that cannot be read back is the user's own
 * words, so the repository must decide what to do about it rather than
 * silently receive a half-built one.
 */
export function fromStored(raw: unknown): MoodEntry {
  const record = asRecord(raw);
  const createdAt = new Date(readString(record, 'createdAt'));

  if (Number.isNaN(createdAt.getTime())) {
    throw new CorruptStoredEntryError('createdAt');
  }

  return MoodEntry.create({
    id: readString(record, 'id'),
    createdAt,
    source: readOneOf(record, 'source', SOURCES),
    rawTranscript: readString(record, 'rawTranscript'),
    cleanTranscript: readString(record, 'cleanTranscript'),
    /*
     * Records written before the field could be empty always carry a number,
     * so nothing old changes meaning; only new entries can arrive without one.
     */
    mood: record['mood'] === null ? null : MoodScore.of(readNumber(record, 'mood')),
    emotionIds: readStringArray(record, 'emotionIds'),
    // Absent on every entry made before the card started asking. Empty is the
    // honest reading of that: those people were never asked, so they never
    // gave an unaided answer, and inventing one would corrupt the only
    // measurement of their own vocabulary we have.
    selfEmotionIds: readOptionalStringArray(record, 'selfEmotionIds') ?? [],
    // Written since the proposal was split from the user's own labels. Older
    // records fall back to the entry's emotions, which is exact for an entry
    // nobody corrected; for a corrected one the revision log holds the truth.
    proposedEmotionIds: readOptionalStringArray(record, 'proposedEmotionIds'),
    contextTags: readStringArray(record, 'contextTags'),
    observation: readNullableString(record, 'observation'),
    confidence: Confidence.of(readNumber(record, 'confidence')),
    safetyFlag: readOneOf(record, 'safetyFlag', SAFETY_FLAGS),
    wasRevisedByUser: readBoolean(record, 'wasRevisedByUser'),
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CorruptStoredEntryError('entry');
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string') {
    throw new CorruptStoredEntryError(key);
  }

  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CorruptStoredEntryError(key);
  }

  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new CorruptStoredEntryError(key);
  }

  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CorruptStoredEntryError(key);
  }

  return value;
}

function readStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new CorruptStoredEntryError(key);
  }

  return value;
}

function readOptionalStringArray(
  record: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  return record[key] === undefined ? undefined : readStringArray(record, key);
}

function readOneOf<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = readString(record, key);
  const match = allowed.find((candidate) => candidate === value);

  if (match === undefined) {
    throw new CorruptStoredEntryError(key);
  }

  return match;
}
