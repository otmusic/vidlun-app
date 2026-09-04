/**
 * A key holder, not a backend.
 *
 * §2 says no backend in the MVP, and this stays honest to it: it knows no
 * users and never sees an entry it does not immediately forget. What it
 * holds is the Anthropic key — which the app cannot, because anything in a
 * bundle can be read out of it — and, since App Attest, the public halves of
 * device keys: not identities, just proof that a caller is a genuine build
 * of this app on real Apple hardware.
 */
import { assertKey, issueChallenge, mintToken, readToken, register, type AttestStore } from './attest';


export interface Env {
  /** The real key. A Worker secret, never in the repository. */
  readonly ANTHROPIC_API_KEY: string;
  /** Signs the short-lived tokens. A Worker secret, rotatable at will. */
  readonly TOKEN_SECRET: string;
  /** Cloudflare's own limiter, configured in wrangler.toml. */
  readonly RATE_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> };
  /** Attested device keys and one-time challenges. */
  readonly ATTEST: AttestStore;
  /** Cloudflare's send-email binding, bound in wrangler.toml. */
  readonly EMAIL: { send(message: FeedbackMail): Promise<unknown> };
  /** Where a person's note lands; a routing address on this zone. */
  readonly FEEDBACK_TO: string;
}

interface FeedbackMail {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly text: string;
}

/** A note is a paragraph or two; anything longer is not a person typing. */
const MAX_FEEDBACK_CHARS = 4_000;

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

/**
 * The three the app actually asks for. A proxy that forwards any model is a
 * proxy someone else can point at the expensive one.
 */
const ALLOWED_MODELS = new Set(['claude-haiku-4-5', 'claude-sonnet-5']);

/** Above this nothing the app asks for is legitimate, and the bill is not either. */
const MAX_TOKENS_CEILING = 4096;

/**
 * The ceiling on what a request may carry in. `max_tokens` caps only the
 * answer; input tokens are billed too, and a week of five-minute entries
 * fits in a tenth of this. Anything larger is not this app talking.
 */
const MAX_BODY_BYTES = 64 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return problem(405, 'Only POST is served here.');
    }

    if (!env.TOKEN_SECRET) {
      // Refusing loudly beats an HMAC stack trace: a missing secret is a
      // deployment mistake, and the message should say whose.
      return problem(500, 'This proxy is deployed without its token secret.');
    }

    const path = new URL(request.url).pathname;

    if (path.startsWith('/attest/')) {
      /*
       * Rate-limited by connecting address, not by key: a fresh enclave key
       * is free to mint, so the register endpoint is exactly where someone
       * would farm fresh rate-limit buckets. The address bounds how fast.
       */
      const limited = await env.RATE_LIMIT.limit({
        key: `attest:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`,
      });

      if (!limited.success) {
        return problem(429, 'Too many attestation requests from this address.');
      }

      return attest(path, request, env);
    }

    if (path !== '/v1/messages' && path !== '/feedback') {
      return problem(404, 'No such path.');
    }

    /*
     * The token is minted by /attest and proves the caller once held a key
     * that Apple attested as living inside a genuine build of this app on
     * real hardware. Nothing shipped in the bundle opens this door.
     */
    const keyId = await readToken(env.TOKEN_SECRET, request.headers.get('x-api-key') ?? '', Date.now());

    if (keyId === null) {
      return problem(401, 'This caller has not proven itself to this proxy.');
    }

    const limited = await env.RATE_LIMIT.limit({ key: keyId });

    if (!limited.success) {
      return problem(429, 'Too many requests from this device.');
    }

    const rawBody = await request.text();

    if (rawBody.length > MAX_BODY_BYTES) {
      return problem(413, 'The body is larger than anything this app sends.');
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return problem(400, 'The body was not JSON.');
    }

    if (path === '/feedback') {
      return feedback(body, env);
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
/**
 * Mails a person's note to the support inbox. Nothing is kept here: the
 * message goes out and the request is forgotten, which is the one promise
 * this worker makes about everything it touches. Only the text and the build
 * it came from travel — the app sends nothing from the journal, and this
 * would refuse a body large enough to carry it.
 */
async function feedback(body: unknown, env: Env): Promise<Response> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return problem(400, 'The body was not an object.');
  }

  const record = body as Record<string, unknown>;
  const text = typeof record['text'] === 'string' ? record['text'].trim() : '';

  if (text.length === 0 || text.length > MAX_FEEDBACK_CHARS) {
    return problem(400, 'The note is empty or longer than a note.');
  }

  const app =
    typeof record['app'] === 'object' && record['app'] !== null
      ? (record['app'] as Record<string, unknown>)
      : {};
  const field = (name: string): string => {
    const value = app[name];

    return typeof value === 'string' ? value.slice(0, 64) : 'unknown';
  };
  const build = `Vidlun ${field('version')} (${field('build')}) · ${field('platform')}`;

  try {
    await env.EMAIL.send({
      to: env.FEEDBACK_TO,
      from: 'feedback@vidlun.app',
      subject: `Vidlun feedback · ${build}`,
      text: `${text}\n\n—\n${build}`,
    });
  } catch {
    return problem(502, 'The note could not be mailed right now.');
  }

  return answer({ status: 'sent' });
}

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
 * The attestation endpoints. Register is the once-per-install ceremony;
 * token is the daily renewal. Both consume a one-time challenge, so a
 * captured request replays as nothing.
 */
async function attest(path: string, request: Request, env: Env): Promise<Response> {
  if (path === '/attest/challenge') {
    return answer({ challenge: await issueChallenge(env.ATTEST) });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return problem(400, 'The body was not JSON.');
  }

  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const keyId = record['keyId'];
  const challenge = record['challenge'];

  if (typeof keyId !== 'string' || typeof challenge !== 'string') {
    return problem(400, 'keyId and challenge are required.');
  }

  try {
    if (path === '/attest/register' && typeof record['attestation'] === 'string') {
      if (!(await register(env.ATTEST, { keyId, challenge, attestation: record['attestation'] }))) {
        return problem(401, 'The challenge was not one this proxy issued.');
      }
    } else if (path === '/attest/token' && typeof record['assertion'] === 'string') {
      if (!(await assertKey(env.ATTEST, { keyId, challenge, assertion: record['assertion'] }))) {
        return problem(401, 'The challenge was not one this proxy issued, or the key is unknown.');
      }
    } else {
      return problem(404, 'No such path.');
    }
  } catch {
    /*
     * A failed verification carries detail worth logging and not worth
     * sharing: whoever sent a forged attestation does not get told which
     * check caught it.
     */
    return problem(401, 'The proof did not verify.');
  }

  return answer({ token: await mintToken(env.TOKEN_SECRET, keyId, Date.now()) });
}

function answer(body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function problem(status: number, detail: string): Response {
  return new Response(JSON.stringify({ error: { type: 'proxy_error', message: detail } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
