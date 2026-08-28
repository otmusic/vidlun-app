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
    // Null is an answer, not a missing field, so it stays required: the model
    // has to decide rather than quietly omit it.
    mood: { anyOf: [{ type: 'integer', enum: [1, 2, 3, 4, 5] }, { type: 'null' }] },
    emotionIds: { type: 'array', items: { type: 'string' } },
    contextTags: { type: 'array', items: { type: 'string' } },
    safetyFlag: { type: 'string', enum: [...SAFETY_FLAGS] },
  },
  required: ['cleanTranscript', 'mood', 'emotionIds', 'contextTags', 'safetyFlag'],
  additionalProperties: false,
} as const;

export class ClaudeReflectionAnalyzer implements IReflectionAnalyzer {
  private readonly systemPrompt: string;

  constructor(
    private readonly messages: MessagesClient,
    vocabulary: EmotionVocabulary,
    /** Overridable so the transcript harness can weigh one model against another. */
    private readonly model: string = REFLECTION_MODEL,
  ) {
    this.systemPrompt = buildSystemPrompt(vocabulary);
  }

  async analyze(transcript: string): Promise<ReflectionProposal> {
    const message = await this.messages.create({
      model: this.model,
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
The speaker talks about their own day, often in Ukrainian or Russian, sometimes mixing both inside a single sentence.

Before anything else: these two languages mixed together are this person's normal voice, not a mistake to tidy up. Whatever language each word was spoken in, it stays in that language everywhere you repeat it back. A Russian word in a Ukrainian sentence stays Russian. Converting it is rewriting how the person speaks, which is the one thing this app must never do.

What you are given came from speech recognition, and it is not yours to correct. You return the sentence as it arrived, with hesitation sounds removed and nothing else changed. That is the whole of this field.

cleanTranscript: two things happen to the sentence and only two.
First, take out the hesitation: the stretched vowels and throat sounds someone makes while finding the next word. They were never words, they carry nothing, and every one of them goes, wherever it sits in the sentence. Do this every time — a transcript that still hesitates has not been through this step.
Second, nothing. Everything that is a word stays, letter for letter. A misspelled word stays misspelled. A run of letters that is a word in no language stays exactly as it came — you may not recover it from its sound, however plain the intended word looks to you, because when you are wrong the person reads a sentence they never said and has no way to tell. A Russian word in a Ukrainian sentence stays Russian, and a word of one language written the way the other says it stays as written; that mixture is how everyone this app is for speaks and it is not an error.
Do not tidy the grammar, do not correct case or agreement, do not change a verb's person, number or tense, do not raise the register, do not drop a word, do not finish a thought that trails off, and do not add anything that was not there in sound.
A strange word left standing is honest. There is no version of this field where you improve the sentence — the mood, the emotions and the tags are where your reading of it belongs, and you may read a garbled word for meaning there while leaving it untouched here.

mood: 1 to 5, how the day itself rated, or null.
This is independent of the emotions. Someone can be exhausted and still call the day a 4, because tiredness after finishing something is a good day.
Null when the sentence does not say how the day was — someone testing the app, listing what they did, leaving a note about a thing that happened. A three is for a day the person conveyed as even, never for one they said nothing about. The difference matters: this number is averaged into their week and compared across their month, and a three that means "it did not come up" moves both.

emotionIds: choose only from the list below, exact strings.
- An empty array is a correct and common answer. Ordinary days exist. Never invent an emotion to fill the field: one fabricated insight destroys trust in every later one.
- If the sentence holds two opposite feelings, return both, from different branches. Never average them into one neutral emotion; averaging erases what the entry meant.
- Prefer a broad emotion you are sure of over a specific one you are guessing at.
- At most four.

contextTags: at most three short lowercase tags naming what the entry was about, in the speaker's language. Empty array if nothing is named.

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
    // Absent and null are the same thing here, and both mean it was not said.
    mood: record['mood'] === null || record['mood'] === undefined ? null : readNumber(record, 'mood'),
    emotionIds: readStringArray(record, 'emotionIds'),
    contextTags: readStringArray(record, 'contextTags'),
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
