import type { EmotionVocabulary } from '../../domain/entities/EmotionVocabulary';
import type { SafetyFlag } from '../../domain/entities/MoodEntry';
import { AnalysisRefusedError, UnreadableAnalysisError } from '../../domain/errors/AnalysisErrors';
import type { IReflectionAnalyzer, ReflectionProposal } from '../../domain/ports/IReflectionAnalyzer';
import {
  readText,
  OBSERVATION_MODEL,
  REFLECTION_MODEL,
  type MessagesClient,
} from './claudeModels';

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
    safetyFlag: { type: 'string', enum: [...SAFETY_FLAGS] },
  },
  required: ['cleanTranscript', 'mood', 'emotionIds', 'contextTags', 'safetyFlag'],
  additionalProperties: false,
} as const;

const OBSERVATION_SCHEMA = {
  type: 'object',
  properties: {
    observation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: ['observation'],
  additionalProperties: false,
} as const;

/**
 * Deliberately without the emotion vocabulary: this call names nothing from
 * it, and the list is the bulk of the other prompt.
 */
const OBSERVATION_PROMPT = `You read one spoken sentence from a voice journal and decide whether Luna has anything worth saying back.

The speaker talks about their own day, often in Ukrainian or Russian, sometimes mixing both inside a single sentence. That mix is their normal voice, not a mistake to tidy up: whatever language a word was spoken in, it stays in that language when you repeat it back.

observation: one short sentence, or null, written in the same language the speaker used. This is the only text Luna says out loud, and answering a Ukrainian sentence in English would be the app talking past the person.
Write a whole sentence rather than a noun phrase, which is a label and not an observation: "financial pressure from a housing payment" is a case note, while "paying the rent is weighing on them" is a remark. Keep it impersonal — describe what the entry sounds like, do not address the speaker as "you".
Stay in the speaker's own vocabulary. Do not upgrade what they said into clinical words: not "difficulty concentrating" for someone who said it is hard to focus, not "anxiety" for someone who said they are worried. A better word is still a word they did not choose.
Notice what the person said; do not diagnose them, do not advise them, and do not praise them. "Sounds like the good kind of tired", "The rent is sitting heavily today", "A quiet day that still took something out of you" are all fine. "You show signs of burnout" and "try sleeping earlier" and "well done for coping" are all wrong.
Vary how the sentence opens. Those examples hedge, state and describe in turn, and that is the point: an app that begins every reflection with the same two words stops sounding like it was listening. Never reuse an opening you would have used on the previous entry.
Do not simply hand the sentence back. Repeating what they said in their own words with a hedge in front is not an observation, it is an echo.
Say only what is in the sentence, and say less rather than more. One clause is usually enough; two feelings joined by "and" usually means the sentence is carrying more than it should.
Silence is the default, not the fallback. Return null whenever there is nothing worth saying, which is often.
Someone reporting what they did — cooking, sitting, looking out of a window — has described a moment, not opened one up. There is nothing to observe there, and reaching for something turns into invention: adding why they were sitting, or what they must have been feeling, puts a thought in their head that they did not put there. Say nothing instead. An entry that gets no reply is a complete entry.
Read the sentence back before answering. It has to be grammatical in the speaker's language on its own terms, not carried word for word out of another one.`;

export class ClaudeReflectionAnalyzer implements IReflectionAnalyzer {
  private readonly systemPrompt: string;

  constructor(
    private readonly messages: MessagesClient,
    vocabulary: EmotionVocabulary,
    /** Overridable so the transcript harness can weigh one model against another. */
    private readonly model: string = REFLECTION_MODEL,
    private readonly observationModel: string = OBSERVATION_MODEL,
  ) {
    this.systemPrompt = buildSystemPrompt(vocabulary);
  }

  /**
   * Two calls, sent together rather than one after the other, so the wait is
   * the slower of them and not their sum. §1 measures this product in seconds.
   */
  async analyze(transcript: string): Promise<ReflectionProposal> {
    const [structure, observation] = await Promise.all([
      this.classify(transcript),
      this.observe(transcript),
    ]);

    return { ...structure, observation };
  }

  private async classify(transcript: string): Promise<Omit<ReflectionProposal, 'observation'>> {
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

  /**
   * The one sentence Luna says out loud, and the only field where a clumsy
   * word form is visible to the user — everything else is an id from a fixed
   * vocabulary, a number, or the speaker's own words echoed back. Measured on
   * 2026-08-24: the small model produced ungrammatical Ukrainian and slid into
   * clinical phrasing the copy rules forbid. It does not need the vocabulary,
   * so this prompt stays small.
   */
  private async observe(transcript: string): Promise<string | null> {
    const message = await this.messages.create({
      model: this.observationModel,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: OBSERVATION_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: OBSERVATION_SCHEMA } },
      messages: [{ role: 'user', content: transcript }],
    });

    if (message.stop_reason === 'refusal') {
      throw new AnalysisRefusedError(message.stop_details?.explanation ?? 'no reason given');
    }

    return parseObservation(readText(message));
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

cleanTranscript: the sentence in the speaker's own language, with filler words and false starts removed. Never translate it, never rewrite what they meant, never add words they did not say.
When one sentence mixes Ukrainian and Russian, leave every word in the language it was spoken in. Fixing a typo or a missing space is fine; swapping a Russian word for its Ukrainian equivalent, or the reverse, is not.

mood: 1 to 5, how the day itself rated. This is independent of the emotions. Someone can be exhausted and still call the day a 4, because tiredness after finishing something is a good day.

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

function parseProposal(raw: string): Omit<ReflectionProposal, 'observation'> {
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
    safetyFlag: readSafetyFlag(record),
  };
}

function parseObservation(raw: string): string | null {
  if (raw.length === 0) {
    throw new UnreadableAnalysisError('the observation response was empty');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UnreadableAnalysisError('the observation response was not JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UnreadableAnalysisError('the observation response was not an object');
  }

  return readNullableString(parsed as Record<string, unknown>, 'observation');
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
