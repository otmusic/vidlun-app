/**
 * A key holder, not a backend.
 *
 * §2 says no backend in the MVP, and this does not become one: it stores
 * nothing, knows no users, and never sees an entry it does not immediately
 * forget. What it does is hold the Anthropic key, which the app cannot —
 * anything shipped in a bundle can be read out of it, and a key read out of it
 * spends the owner's money.
 *
 * The app talks to this exactly as it talked to Anthropic, so the change on
 * the other side is a base URL and nothing else.
 */

export interface Env {
  /** The real key. A Worker secret, never in the repository. */
  readonly ANTHROPIC_API_KEY: string;
  /**
   * What a build of the app sends in place of a key. Rotatable without
   * touching Anthropic, and worth exactly as much as the bundle it ships in —
   * see the note on App Attest below.
   */
  readonly APP_TOKEN: string;
  /** Cloudflare's own limiter, configured in wrangler.toml. */
  readonly RATE_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> };
}

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

/**
 * The three the app actually asks for. A proxy that forwards any model is a
 * proxy someone else can point at the expensive one.
 */
const ALLOWED_MODELS = new Set(['claude-haiku-4-5', 'claude-sonnet-5']);

/** Above this nothing the app asks for is legitimate, and the bill is not either. */
const MAX_TOKENS_CEILING = 4096;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return problem(405, 'Only POST is served here.');
    }

    if (new URL(request.url).pathname !== '/v1/messages') {
      return problem(404, 'No such path.');
    }

    /*
     * Timing-safe would be better and is not available at the edge without
     * pulling in crypto; the token is not a password and the window is a
     * single string compare against a fixed-length value.
     */
    if (request.headers.get('x-api-key') !== env.APP_TOKEN) {
      return problem(401, 'This build is not allowed to use this proxy.');
    }

    const limited = await env.RATE_LIMIT.limit({ key: clientKey(request) });

    if (!limited.success) {
      return problem(429, 'Too many requests from this device.');
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return problem(400, 'The body was not JSON.');
    }

    const refusal = checkBody(body);

    if (refusal !== null) {
      return problem(400, refusal);
    }

    const answer = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify(body),
    });

    /*
     * Passed through as it came. The app already knows how to read an
     * Anthropic error, and rewriting one here would hide the reason from
     * whoever has to debug it.
     */
    return new Response(answer.body, {
      status: answer.status,
      headers: { 'content-type': answer.headers.get('content-type') ?? 'application/json' },
    });
  },
};

/** What the caller may ask for, checked before any of it costs anything. */
function checkBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'The body was not an object.';
  }

  const record = body as Record<string, unknown>;
  const model = record['model'];

  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
    return 'That model is not served here.';
  }

  const maxTokens = record['max_tokens'];

  if (typeof maxTokens !== 'number' || maxTokens <= 0 || maxTokens > MAX_TOKENS_CEILING) {
    return 'max_tokens is missing or past the ceiling.';
  }

  return null;
}

/**
 * One bucket per device, falling back to the connecting address.
 *
 * The header is the app's own anonymous install id — it identifies a phone to
 * the limiter and nothing else, and it is not tied to a person, an account or
 * an entry. **This is the weak part of the whole design**: a determined caller
 * can change it and get a fresh bucket, and the token above ships in a bundle
 * anyone can read. App Attest is the real fix — it proves the caller is a
 * genuine build of this app — and it is the next thing to do here.
 */
function clientKey(request: Request): string {
  return (
    request.headers.get('x-vidlun-install') ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

function problem(status: number, detail: string): Response {
  return new Response(JSON.stringify({ error: { type: 'proxy_error', message: detail } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
