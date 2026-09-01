import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { AnalysisRefusedError, UnreadableAnalysisError } from '../../domain/errors/AnalysisErrors';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';
import { NARRATIVE_MODEL, readText, type MessagesClient } from './claudeModels';

/** Two or three sentences on the insights screen; anything longer is not read. */
const MAX_TOKENS = 1024;

/** Which stretch of time the voice is writing about. */
export type NarrativeSpan = 'week' | 'month';

const PROMPTS: Record<NarrativeSpan, string> = {
  week: `You write the weekly summary in a voice journal.

Two or three sentences, in the language the entries are written in. Say what the week looked like from the outside: when the good days fell, what came up again and again, what changed between the start and the end.

Notice, do not interpret. You may say "calm came more often in the mornings, tension on working evenings". You may not tell the person what it means about them, what they should do about it, or how well they handled it. No diagnosis, no advice, no praise, no encouragement.

If the week is too thin to say anything true about, say so through the days themselves rather than by counting entries — open with what was said, never with how much of it there is or how hard it is to judge.`,
  month: `You write the monthly summary in a voice journal.

Three or four sentences, in the language the entries are written in. Say what the month looked like from the outside: how it moved from its start to its end, what kept returning, which weeks stood apart and how.

Notice, do not interpret. You may say "the first half sounded heavier, and work came up in most of the tired entries". You may not tell the person what it means about them, what they should do about it, or how well they handled it. No diagnosis, no advice, no praise, no encouragement.

If the month is too thin to say anything true about, say so through the days themselves rather than by counting entries — open with what was said, never with how much of it there is or how hard it is to judge.`,
};

/**
 * Bumped whenever a prompt above changes meaningfully. The cache folds this
 * into its fingerprint, so a new voice rewrites old rows instead of being
 * hidden behind them.
 */
export const NARRATIVE_PROMPT_VERSION = 2;

export class ClaudeNarrativeGenerator implements INarrativeGenerator {
  constructor(
    private readonly messages: MessagesClient,
    private readonly span: NarrativeSpan = 'week',
  ) {}

  async generate(entries: readonly MoodEntry[]): Promise<string> {
    const message = await this.messages.create({
      model: NARRATIVE_MODEL,
      max_tokens: MAX_TOKENS,
      system: PROMPTS[this.span],
      // Three sentences of observation need no deliberation, and the user is
      // waiting on the insights screen while this runs.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: describeWeek(entries) }],
    });

    if (message.stop_reason === 'refusal') {
      throw new AnalysisRefusedError(message.stop_details?.explanation ?? 'no reason given');
    }

    const narrative = readText(message);

    if (narrative.length === 0) {
      throw new UnreadableAnalysisError('the response carried no text');
    }

    return narrative;
  }
}

function describeWeek(entries: readonly MoodEntry[]): string {
  return entries.map(describeEntry).join('\n');
}

function describeEntry(entry: MoodEntry): string {
  const day = entry.createdAt.toISOString().slice(0, 10);
  const emotions = entry.emotionIds.length > 0 ? entry.emotionIds.join(', ') : 'none';
  const tags = entry.contextTags.length > 0 ? entry.contextTags.join(', ') : 'none';

  // "not said" rather than a number: the model reading these must not average
  // a stand-in into a sentence about someone's week.
  const mood = entry.mood === null ? 'not said' : String(entry.mood.value);

  return `${day} | mood ${mood} | emotions: ${emotions} | about: ${tags} | "${entry.cleanTranscript}"`;
}
