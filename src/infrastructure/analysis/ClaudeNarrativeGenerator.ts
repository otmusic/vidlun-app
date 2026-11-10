import type { MoodEntry } from '../../domain/entities/MoodEntry';
import { isOwnWord, ownWordText } from '../../domain/entities/OwnWord';
import { AnalysisRefusedError, UnreadableAnalysisError } from '../../domain/errors/AnalysisErrors';
import type { INarrativeGenerator } from '../../domain/ports/INarrativeGenerator';
import { NARRATIVE_MODEL, PATIENT_TIMEOUT_MS, readText, type MessagesClient } from './claudeModels';

/** Two or three sentences on the insights screen; anything longer is not read. */
const MAX_TOKENS = 1024;

/**
 * The month written back. There was a weekly voice beside it until
 * 2026-10-01; the owner folded the week into the month, which says the same
 * things with room to see them repeat.
 */
const PROMPT = `You tell someone, in a few sentences, how their month looked, from what they said in their voice journal below.

Sound like a close friend who has read everything and is telling them, kindly and simply, what their month was like. A person talking about a life, not a report about data. Write in the language the entries are written in, with short sentences and everyday words, nothing a person has to read twice.

- Three or four sentences, under 70 words in all.
- Say how the month went from its start to its end and what came up again and again. Pick two or three things that mattered, in the person's own everyday words where you can, not everything that happened.
- Talk about the life, never about the journal: never mention entries, records, moods, scores, emotions as a category, numbers of days, trends or patterns.
- Plain words only, no metaphors and no literary turns. Nothing "runs through" the month, there are no "waves", "threads" or "storylines", nothing "flows into" something else and no stretch of days "holds its balance". Say what happened: "the tooth hurt for about two weeks", "work was tiring towards the end of the month".
- A health problem is said as gently, plainly and briefly as the person said it, never as a theme of the month and never in clinical words they did not use.
- You may speak to the person ("your month"), but never with a past-tense verb whose subject is them: in Ukrainian and Russian it says whether they are a man or a woman. Let the month, the days or the things be the subject instead: "the month started with the wedding", "work was hard at the end".

Notice, do not interpret. You may say "the first half was heavier, and work came up on most of the tired days". You may not tell the person what it means about them, what they should do about it, or how well they handled it. No diagnosis, no advice, no praise, no encouragement.

If the month is too thin to say anything true about, say so through the days themselves rather than by counting entries — open with what was said, never with how much of it there is or how hard it is to judge.`;

/**
 * Bumped whenever the prompt above changes meaningfully. 3 is the plain,
 * human month (owner's word, 2026-11-06: the tooth was "a storyline running
 * through the month", which nobody says about their own toothache, and the
 * text has to sound like a person, not a summary of data). The cache folds this
 * into its fingerprint, so a new voice rewrites old rows instead of being
 * hidden behind them.
 */
export const NARRATIVE_PROMPT_VERSION = 3;

export class ClaudeNarrativeGenerator implements INarrativeGenerator {
  constructor(private readonly messages: MessagesClient) {}

  async generate(entries: readonly MoodEntry[]): Promise<string> {
    const message = await this.messages.create({
      model: NARRATIVE_MODEL,
      max_tokens: MAX_TOKENS,
      system: PROMPT,
      // Three sentences of observation need no deliberation, and the user is
      // waiting on the insights screen while this runs.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: describeEntries(entries) }],
    }, { timeout: PATIENT_TIMEOUT_MS });

    if (message.stop_reason === 'refusal') {
      throw new AnalysisRefusedError(message.stop_details?.explanation ?? 'no reason given');
    }

    const narrative = joinApostrophes(readText(message));

    if (narrative.length === 0) {
      throw new UnreadableAnalysisError('the response carried no text');
    }

    return narrative;
  }
}

/*
 * The Ukrainian apostrophe as the model sometimes hands it back: split off
 * its word by a space on one side or both, as in the owner's September
 * (2026-11-06). Only the apostrophe characters that never open a quotation
 * are joined, so a quoted word after a space is left alone.
 */
const SPLIT_APOSTROPHE = /([\u0400-\u04FF])\s*([\u02BC\u2019])\s*(?=[\u0400-\u04FF])/g;

function joinApostrophes(text: string): string {
  return text.replace(SPLIT_APOSTROPHE, '$1$2');
}

function describeEntries(entries: readonly MoodEntry[]): string {
  return entries.map(describeEntry).join('\n');
}

function describeEntry(entry: MoodEntry): string {
  const day = entry.createdAt.toISOString().slice(0, 10);
  const emotions = entry.emotionIds.length > 0 ? entry.emotionIds.map(describeEmotion).join(', ') : 'none';
  const tags = entry.contextTags.length > 0 ? entry.contextTags.join(', ') : 'none';

  // "not said" rather than a number: the model reading these must not average
  // a stand-in into a sentence about someone's month.
  const mood = entry.mood === null ? 'not said' : String(entry.mood.value);

  return `${day} | mood ${mood} | emotions: ${emotions} | about: ${tags} | "${entry.cleanTranscript}"`;
}

/**
 * A vocabulary id as it is, and a feeling the person typed as their word in
 * quotes: the model reads a phrase the person chose, not the storage prefix
 * that keeps it apart from the vocabulary.
 */
function describeEmotion(id: string): string {
  return isOwnWord(id) ? `"${ownWordText(id)}" (their own word)` : id;
}
