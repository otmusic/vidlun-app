import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { AnalysisRefusedError, UnreadableAnalysisError } from '../../domain/errors/AnalysisErrors';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';
import { NARRATIVE_MODEL, readText, type MessagesClient } from './claudeModels';

/** Two or three sentences on the insights screen; anything longer is not read. */
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You write the weekly summary in a voice journal.

Two or three sentences, in the language the entries are written in. Say what the week looked like from the outside: when the good days fell, what came up again and again, what changed between the start and the end.

Notice, do not interpret. You may say "calm came more often in the mornings, tension on working evenings". You may not tell the person what it means about them, what they should do about it, or how well they handled it. No diagnosis, no advice, no praise, no encouragement.

If the week is too thin to say anything true about, say that plainly in one sentence rather than inventing a pattern.`;

export class ClaudeNarrativeGenerator implements INarrativeGenerator {
  constructor(private readonly messages: MessagesClient) {}

  async generate(entries: readonly MoodEntry[]): Promise<string> {
    const message = await this.messages.create({
      model: NARRATIVE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
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

  return `${day} | mood ${entry.mood.value} | emotions: ${emotions} | about: ${tags} | "${entry.cleanTranscript}"`;
}
