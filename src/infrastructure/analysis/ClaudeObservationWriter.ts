import { AnalysisRefusedError, UnreadableAnalysisError } from '../../domain/errors/AnalysisErrors';
import type { IObservationWriter } from '../../domain/ports/IObservationWriter';
import { readText, OBSERVATION_MODEL, type MessagesClient } from './claudeModels';

/** One short sentence needs no more room than this. */
const MAX_TOKENS = 512;

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
const OBSERVATION_PROMPT = `You read one spoken sentence from a voice journal and decide whether Vidlun has anything worth saying back.

The speaker talks about their own day, often in Ukrainian or Russian, sometimes mixing both inside a single sentence. That mix is their normal voice, not a mistake to tidy up: whatever language a word was spoken in, it stays in that language when you repeat it back.

observation: one short sentence, or null, written in the same language the speaker used. This is the only text Vidlun says out loud, and answering a Ukrainian sentence in English would be the app talking past the person.
Write a whole sentence rather than a noun phrase, which is a label and not an observation: "financial pressure from a housing payment" is a case note, while "paying the rent is weighing on them" is a remark. Keep it impersonal — describe what the entry sounds like, do not address the speaker as "you".
Stay in the speaker's own vocabulary. Do not upgrade what they said into clinical words: not "difficulty concentrating" for someone who said it is hard to focus, not "anxiety" for someone who said they are worried. A better word is still a word they did not choose.
Notice what the person said; do not diagnose them, do not advise them, and do not praise them. "Sounds like the good kind of tired", "The rent is sitting heavily today", "A quiet day that still took something out of you" are all fine. "You show signs of burnout" and "try sleeping earlier" and "well done for coping" are all wrong.
Vary how the sentence opens. Those examples hedge, state and describe in turn, and that is the point: an app that begins every reflection with the same two words stops sounding like it was listening. Never reuse an opening you would have used on the previous entry.
Do not simply hand the sentence back. Repeating what they said in their own words with a hedge in front is not an observation, it is an echo.
Say only what is in the sentence, and say less rather than more. One clause is usually enough; two feelings joined by "and" usually means the sentence is carrying more than it should.
Silence is the default, not the fallback. Return null whenever there is nothing worth saying, which is often.
Someone reporting what they did — cooking, sitting, looking out of a window — has described a moment, not opened one up. There is nothing to observe there, and reaching for something turns into invention: adding why they were sitting, or what they must have been feeling, puts a thought in their head that they did not put there. Say nothing instead. An entry that gets no reply is a complete entry.
Read the sentence back before answering. It has to be grammatical in the speaker's language on its own terms, not carried word for word out of another one.`;

export class ClaudeObservationWriter implements IObservationWriter {
  constructor(
    private readonly messages: MessagesClient,
    /** Overridable so the transcript harness can weigh one model against another. */
    private readonly model: string = OBSERVATION_MODEL,
  ) {}

  async observe(transcript: string): Promise<string | null> {
    const message = await this.messages.create({
      model: this.model,
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

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new UnreadableAnalysisError(`"${key}" was not a string`);
  }

  return value;
}
