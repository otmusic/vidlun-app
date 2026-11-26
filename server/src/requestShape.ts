/**
 * What the app may ask Claude for, and nothing else.
 *
 * The proxy used to check only the model and the length of the answer, then
 * pass the caller's body on whole: whatever system prompt, tools or
 * conversation it carried. Anyone who read a token off their own phone could
 * use the key for anything (security review, 2026-11-26). Every version the
 * app has shipped asks for one of two shapes — a reflection on Haiku and a
 * month on Sonnet, plus the year echo on Haiku until 1.10 — so the body is
 * rebuilt from those shapes, and a field none of them uses is refused rather
 * than forwarded.
 */

/** Which daily allowance a request draws on. */
export type RequestKind = 'haiku' | 'sonnet';

/** The model each kind is, and the longest answer any version of the app asks it for. */
const MODELS: Readonly<Record<string, { readonly kind: RequestKind; readonly maxTokens: number }>> = {
  'claude-haiku-4-5': { kind: 'haiku', maxTokens: 2048 },
  'claude-sonnet-5': { kind: 'sonnet', maxTokens: 1024 },
};

/** The top-level fields the app has ever sent. */
const FIELDS = new Set(['model', 'max_tokens', 'system', 'messages', 'output_config', 'thinking']);

/** A reflection is the transcript and, sometimes, a line about the voice. */
const MAX_CONTENT_BLOCKS = 4;

export type ShapedRequest =
  | { readonly ok: true; readonly kind: RequestKind; readonly body: Record<string, unknown> }
  | { readonly ok: false; readonly refusal: string };

export function shapeRequest(raw: unknown): ShapedRequest {
  if (!isRecord(raw)) {
    return refuse('The body was not an object.');
  }

  const unknownField = Object.keys(raw).find((key) => !FIELDS.has(key));

  if (unknownField !== undefined) {
    return refuse(`The field ${unknownField} is not served here.`);
  }

  const model = raw['model'];
  const served = typeof model === 'string' ? MODELS[model] : undefined;

  if (typeof model !== 'string' || served === undefined) {
    return refuse('That model is not served here.');
  }

  const maxTokens = raw['max_tokens'];

  if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > served.maxTokens) {
    return refuse('max_tokens is missing or past the ceiling for this model.');
  }

  const system = shapeSystem(raw['system']);
  const messages = shapeMessages(raw['messages']);
  const outputConfig = raw['output_config'] === undefined ? undefined : shapeOutputConfig(raw['output_config']);
  const thinking = raw['thinking'] === undefined ? undefined : shapeThinking(raw['thinking']);

  if (system === null) {
    return refuse('The system prompt is not one this app sends.');
  }

  if (messages === null) {
    return refuse('The messages are not what this app sends: one user turn of text.');
  }

  if (outputConfig === null) {
    return refuse('output_config is not what this app sends.');
  }

  if (thinking === null) {
    return refuse('thinking is not what this app sends.');
  }

  const body: Record<string, unknown> = { model, max_tokens: maxTokens, system, messages };

  if (outputConfig !== undefined) {
    body['output_config'] = outputConfig;
  }

  if (thinking !== undefined) {
    body['thinking'] = thinking;
  }

  return { ok: true, kind: served.kind, body };
}

/** A string, or one or two text blocks that may ask for the prompt cache. */
function shapeSystem(value: unknown): unknown {
  if (typeof value === 'string') {
    return value;
  }

  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    return null;
  }

  const blocks = value.map((block: unknown) => {
    if (!isRecord(block) || !hasOnly(block, ['type', 'text', 'cache_control'])) {
      return null;
    }

    if (block['type'] !== 'text' || typeof block['text'] !== 'string') {
      return null;
    }

    const cache = block['cache_control'];

    if (cache === undefined) {
      return { type: 'text', text: block['text'] };
    }

    if (!isRecord(cache) || !hasOnly(cache, ['type']) || cache['type'] !== 'ephemeral') {
      return null;
    }

    return { type: 'text', text: block['text'], cache_control: { type: 'ephemeral' } };
  });

  return blocks.includes(null) ? null : blocks;
}

/** One user turn: a string, or a few text blocks. No images, documents, tool results or second turn. */
function shapeMessages(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || value.length !== 1) {
    return null;
  }

  const turn: unknown = value[0];

  if (!isRecord(turn) || !hasOnly(turn, ['role', 'content']) || turn['role'] !== 'user') {
    return null;
  }

  const content = turn['content'];

  if (typeof content === 'string') {
    return [{ role: 'user', content }];
  }

  if (!Array.isArray(content) || content.length === 0 || content.length > MAX_CONTENT_BLOCKS) {
    return null;
  }

  const blocks = content.map((block: unknown) =>
    isRecord(block) && hasOnly(block, ['type', 'text']) && block['type'] === 'text' && typeof block['text'] === 'string'
      ? { type: 'text', text: block['text'] }
      : null,
  );

  return blocks.includes(null) ? null : [{ role: 'user', content: blocks }];
}

/** A JSON schema to answer in, or a low effort; nothing else the API offers there. */
function shapeOutputConfig(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !hasOnly(value, ['format', 'effort'])) {
    return null;
  }

  const shaped: Record<string, unknown> = {};
  const format = value['format'];
  const effort = value['effort'];

  if (format !== undefined) {
    if (!isRecord(format) || !hasOnly(format, ['type', 'schema']) || format['type'] !== 'json_schema' || !isRecord(format['schema'])) {
      return null;
    }

    shaped['format'] = { type: 'json_schema', schema: format['schema'] };
  }

  if (effort !== undefined) {
    if (effort !== 'low' && effort !== 'medium' && effort !== 'high') {
      return null;
    }

    shaped['effort'] = effort;
  }

  return shaped;
}

/** The app only ever turns thinking off. */
function shapeThinking(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && hasOnly(value, ['type']) && value['type'] === 'disabled' ? { type: 'disabled' } : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnly(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function refuse(refusal: string): ShapedRequest {
  return { ok: false, refusal };
}
