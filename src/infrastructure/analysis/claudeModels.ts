import type Anthropic from '@anthropic-ai/sdk';

/**
 * The seam the Claude adapters talk to. Injected so the adapters can be tested
 * in plain Node against a hand-written fake instead of the network.
 */
export interface MessagesClient {
  create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
}

/** Per-entry analysis. Cheap and fast, because it runs on the capture path. */
export const REFLECTION_MODEL = 'claude-haiku-4-5';

/**
 * The observation, split out from the rest of the entry. It is the only field
 * a user reads as prose, and the small model wrote ungrammatical Ukrainian in
 * it — see BACKLOG. Sent in parallel with the classification, so this buys
 * quality without adding to the wait.
 */
export const OBSERVATION_MODEL = 'claude-sonnet-5';

/** The weekly narrative. Runs once a week, so it can afford the better model. */
export const NARRATIVE_MODEL = 'claude-sonnet-5';

export function readText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}
