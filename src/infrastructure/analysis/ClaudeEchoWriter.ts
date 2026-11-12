import { AnalysisRefusedError, UnreadableAnalysisError } from '../../domain/errors/AnalysisErrors';
import type { EchoInput, IEchoWriter } from '../../domain/ports/IEchoWriter';
import { ECHO_MODEL, PATIENT_TIMEOUT_MS, readText, type MessagesClient } from './claudeModels';
import { voiceNote } from './ClaudeReflectionAnalyzer';
import REGISTER from './echoRegister.json';

/** One short sentence needs no more room than this. */
const MAX_TOKENS = 512;

const ECHO_SCHEMA = {
  type: 'object',
  properties: {
    echo: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: ['echo'],
  additionalProperties: false,
} as const;

/*
 * The tone is the owner's (2026-11-12): warm, calm, human, unobtrusive;
 * never grand, poetic, psychological, medical or formal. The rest is what
 * the first echo learned before it was taken out: say less, stay in the
 * person's own words, and silence is a complete answer.
 */
const ECHO_PROMPT = `You write the echo for one entry in a voice journal: one short sentence Vidlun says back after the person has saved the entry.

You are given what the person said, the mood they gave the day (1 to 5, or none), the emotions they chose themselves (ids from the app's vocabulary), and, for a spoken entry, how their voice sounded against their own usual voice, measured on the phone: quieter or louder, lower or higher, flatter or livelier (how much the pitch moves), slower or faster, more or fewer pauses — or "as usual" when nothing stood out.

What the echo is for: noticing what a transcript alone would miss, most of all where the voice and the words go different ways — a good day told in a quiet, flat, slow voice; a hard day told briskly. When nothing in the voice stands out, or it was not measured, one plain remark about the entry, and only if there is something worth saying. The person should feel heard, not analysed.

How it sounds:
- Warm, calm, human and unobtrusive, like a friend who listened — not a therapist, a doctor or an app.
- Plain everyday words a native speaker would use. No psychological, medical or clinical words (not "anxiety", "stress response", "emotional state", "symptoms"), no formal register, no poetic images or metaphors, nothing grand.
- Never diagnose, advise or praise, and do not ask a question. No exclamation marks.
- Say what the voice did as something about the voice, never a verdict about the person: "your voice sounds tired", not "you are exhausted".
- Hedge lightly ("sounds", "seems", or the same in the person's language) only where it helps; never pile hedges up.
- One sentence, at most about fifteen words.
- Do not hand their sentence back, do not list measurements, do not name the emotions they chose — they already have — and never mention measuring, the phone, analysis or numbers.
- Vary how the sentence opens.
- Return null for an entry with nothing to reflect on: a test, a list of things done, a note about a fact. Silence is a complete answer.

Language: write in the language the person spoke. If they mixed Ukrainian and Russian, write in Ukrainian. Never answer a Ukrainian entry in English. English is US English.

Ukrainian grammar, and it matters: speak to the person in the informal singular and only in the present tense. A past-tense verb about them or an adjective that agrees with them shows a gender the app does not know (${REGISTER.gendered.map((words) => `"${words}"`).join(', ')}), so neither may appear. Describe the voice, the words or the day instead. Read the sentence back before answering: it must sound like something a Ukrainian would actually say, not a translation.

The register, not templates:
${REGISTER.examples.map((example) => `- "${example}"`).join('\n')}`;

export class ClaudeEchoWriter implements IEchoWriter {
  constructor(
    private readonly messages: MessagesClient,
    /** Overridable so the transcript harness can weigh one model against another. */
    private readonly model: string = ECHO_MODEL,
  ) {}

  async write(input: EchoInput): Promise<string | null> {
    const message = await this.messages.create(
      {
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: [{ type: 'text', text: ECHO_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { format: { type: 'json_schema', schema: ECHO_SCHEMA } },
        messages: [{ role: 'user', content: describe(input) }],
      },
      { timeout: PATIENT_TIMEOUT_MS },
    );

    if (message.stop_reason === 'refusal') {
      throw new AnalysisRefusedError(message.stop_details?.explanation ?? 'no reason given');
    }

    return parseEcho(readText(message));
  }
}

/** The entry as the model reads it: what was said first, then what the person kept, then the voice. */
export function describe(input: EchoInput): string {
  return [
    `What was said: ${input.transcript}`,
    `Mood: ${input.mood === null ? 'none' : `${input.mood} of 5`}.`,
    `Emotions they chose: ${input.emotionIds.length === 0 ? 'none' : input.emotionIds.join(', ')}.`,
    input.voice === null ? 'Voice: not measured.' : voiceNote(input.voice),
  ].join('\n');
}

function parseEcho(raw: string): string | null {
  if (raw.length === 0) {
    throw new UnreadableAnalysisError('the echo response was empty');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UnreadableAnalysisError('the echo response was not JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UnreadableAnalysisError('the echo response was not an object');
  }

  const echo = (parsed as Record<string, unknown>)['echo'];

  if (echo === null || echo === undefined) {
    return null;
  }

  if (typeof echo !== 'string') {
    throw new UnreadableAnalysisError('"echo" was not a string');
  }

  return echo.trim().length === 0 ? null : echo.trim();
}
