import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { SafetyFlag } from '../../domain/entities/MoodEntry';
import { AnalysisRefusedError, UnreadableAnalysisError } from '../../domain/errors/AnalysisErrors';
import type { IReflectionAnalyzer, ReflectionProposal } from '../../domain/ports/IReflectionAnalyzer';
import { readText, REFLECTION_MODEL, type MessagesClient } from './claudeModels';

/** A reflection is a handful of short fields; a larger ceiling would only hide bugs. */
const MAX_TOKENS = 2048;

const SAFETY_FLAGS: readonly SafetyFlag[] = ['none', 'distress', 'crisis'];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    cleanTranscript: { type: 'string' },
    mood: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    emotionIds: { type: 'array', items: { type: 'string' } },
    contextTags: { type: 'array', items: { type: 'string' } },
    observation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    safetyFlag: { type: 'string', enum: [...SAFETY_FLAGS] },
  },
  required: ['cleanTranscript', 'mood', 'emotionIds', 'contextTags', 'observation', 'safetyFlag'],
  additionalProperties: false,
} as const;

export class ClaudeReflectionAnalyzer implements IReflectionAnalyzer {
  private readonly systemPrompt: string;

  constructor(
    private readonly messages: MessagesClient,
    vocabulary: EmotionVocabulary,
  ) {
    this.systemPrompt = buildSystemPrompt(vocabulary);
  }

  async analyze(transcript: string): Promise<ReflectionProposal> {
    const message = await this.messages.create({
      model: REFLECTION_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: this.systemPrompt,
          // The rules and the vocabulary are identical on every call. Caching
          // only engages once the prefix passes this model's minimum, so treat
          // it as an optimisation that may not fire rather than a guarantee.
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
      messages: [{ role: 'user', content: transcript }],
    });

    if (message.stop_reason === 'refusal') {
      throw new AnalysisRefusedError(message.stop_details?.explanation ?? 'no reason given');
    }

    return parseProposal(readText(message));
  }
}

function buildSystemPrompt(vocabulary: EmotionVocabulary): string {
  const allowedIds = vocabulary
    .all()
    .filter((emotion) => emotion.isProposableByAi)
    .map((emotion) => emotion.id)
    .join('\n');

  return `You turn one spoken sentence from a voice journal into a structured draft.
The speaker talks about their own day, often in Ukrainian or Russian, sometimes mixing both in one sentence.

cleanTranscript: the sentence in the speaker's own language, with filler words and false starts removed. Never translate it, never rewrite what they meant, never add words they did not say.

mood: 1 to 5, how the day itself rated. This is independent of the emotions. Someone can be exhausted and still call the day a 4, because tiredness after finishing something is a good day.

emotionIds: choose only from the list below, exact strings.
- An empty array is a correct and common answer. Ordinary days exist. Never invent an emotion to fill the field: one fabricated insight destroys trust in every later one.
- If the sentence holds two opposite feelings, return both, from different branches. Never average them into one neutral emotion; averaging erases what the entry meant.
- Prefer a broad emotion you are sure of over a specific one you are guessing at.
- At most four.

contextTags: at most three short lowercase tags naming what the entry was about, in the speaker's language. Empty array if nothing is named.

observation: one short sentence, or null. Notice what the person said; do not diagnose them, do not advise them, and do not praise them. "Sounds like the good kind of tired" is fine. "You show signs of burnout" and "try sleeping earlier" and "well done for coping" are all wrong. Return null whenever there is nothing worth saying, which is often.

safetyFlag: read only the content of the sentence. Use "distress" when the speaker sounds badly overwhelmed, "crisis" when they refer to harming themselves, and "none" otherwise. Feeling bad is not a crisis.

Allowed emotion ids:
${allowedIds}`;
}

function parseProposal(raw: string): ReflectionProposal {
  if (raw.length === 0) {
    throw new UnreadableAnalysisError('the response was empty');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UnreadableAnalysisError('the response was not JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UnreadableAnalysisError('the response was not an object');
  }

  const record = parsed as Record<string, unknown>;

  return {
    cleanTranscript: readString(record, 'cleanTranscript'),
    mood: readNumber(record, 'mood'),
    emotionIds: readStringArray(record, 'emotionIds'),
    contextTags: readStringArray(record, 'contextTags'),
    observation: readNullableString(record, 'observation'),
    safetyFlag: readSafetyFlag(record),
  };
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string') {
    throw new UnreadableAnalysisError(`"${key}" was not a string`);
  }

  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new UnreadableAnalysisError(`"${key}" was not a string or null`);
  }

  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new UnreadableAnalysisError(`"${key}" was not a number`);
  }

  return value;
}

function readStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new UnreadableAnalysisError(`"${key}" was not an array of strings`);
  }

  return value;
}

/**
 * An unknown flag is treated as "none" rather than rejected: the entry is still
 * the user's, and the use case decides what a missing signal means.
 */
function readSafetyFlag(record: Record<string, unknown>): SafetyFlag {
  const value = record['safetyFlag'];

  return SAFETY_FLAGS.find((flag) => flag === value) ?? 'none';
}
