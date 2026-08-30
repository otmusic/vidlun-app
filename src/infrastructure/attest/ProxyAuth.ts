import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  attestAppKey,
  generateAppAssertion,
  generateAppAttestKey,
} from 'react-native-app-attest';

/**
 * How this app proves to the proxy that it is this app.
 *
 * The proof is a key the Secure Enclave made and will not give up: Apple
 * attests it once, and afterwards each day's token is bought with a fresh
 * signature. Nothing that opens the proxy ships in the bundle any more —
 * pulling the app apart yields no secret worth having.
 *
 * The key id and token live in AsyncStorage deliberately: neither is a
 * secret. The id is a handle that is useless off this phone, and the token
 * expires within a day of anyone reading it.
 */
/** Waiting longer than this on an auth round trip only delays the entry more. */
const FETCH_TIMEOUT_MS = 15_000;

const KEY_ID = 'vidlun.attest.keyId';
const REGISTERED = 'vidlun.attest.registered';
const TOKEN = 'vidlun.attest.token';
const TOKEN_EXPIRES = 'vidlun.attest.tokenExpiresAt';

/** Renewed this long before it would expire, so a request never carries a stale one. */
const RENEW_MARGIN_MS = 60 * 60 * 1000;

/** Matches the proxy's day; only read to know when to renew. */
const TOKEN_LIFE_MS = 24 * 60 * 60 * 1000;

export class ProxyAuth {
  constructor(private readonly baseUrl: string) {}

  /** One renewal at a time; concurrent requests share it. */
  private renewing: Promise<string> | null = null;

  async token(): Promise<string> {
    const [token, expires] = await Promise.all([
      AsyncStorage.getItem(TOKEN),
      AsyncStorage.getItem(TOKEN_EXPIRES),
    ]);

    if (token !== null && expires !== null && Number(expires) - RENEW_MARGIN_MS > Date.now()) {
      return token;
    }

    return this.renew();
  }

  /** Called after a 401: the stored token is wrong whatever its clock says. */
  renew(): Promise<string> {
    this.renewing ??= this.performRenewal().finally(() => {
      this.renewing = null;
    });

    return this.renewing;
  }

  private async performRenewal(): Promise<string> {
    const keyId = await AsyncStorage.getItem(KEY_ID);
    const registered = (await AsyncStorage.getItem(REGISTERED)) === 'true';

    if (keyId !== null && registered) {
      try {
        return await this.keep(await this.assertOnce(keyId));
      } catch {
        /*
         * The proxy no longer knows this key — its store was cleared, or the
         * registration never finished. The enclave can always mint another;
         * falling through re-runs the ceremony rather than failing the entry.
         */
      }
    }

    return this.registerFresh();
  }

  /** The everyday path: sign a fresh challenge with the attested key. */
  private async assertOnce(keyId: string): Promise<string> {
    const challenge = await this.challenge();
    const assertion = await generateAppAssertion(keyId, challenge);

    return this.exchange('/attest/token', { keyId, challenge, assertion });
  }

  /** The once-per-install ceremony, ending with a token like any other day. */
  private async registerFresh(): Promise<string> {
    const keyId = await generateAppAttestKey();
    const challenge = await this.challenge();
    const attestation = await attestAppKey(keyId, challenge);
    const token = await this.exchange('/attest/register', { keyId, challenge, attestation });

    await AsyncStorage.multiSet([
      [KEY_ID, keyId],
      [REGISTERED, 'true'],
    ]);

    return this.keep(token);
  }

  private async keep(token: string): Promise<string> {
    await AsyncStorage.multiSet([
      [TOKEN, token],
      [TOKEN_EXPIRES, String(Date.now() + TOKEN_LIFE_MS)],
    ]);

    return token;
  }

  private async challenge(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/attest/challenge`, {
      method: 'POST',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = (await response.json()) as { challenge?: string };

    if (typeof body.challenge !== 'string') {
      throw new Error('the proxy did not issue a challenge');
    }

    return body.challenge;
  }

  private async exchange(path: string, payload: Record<string, string>): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = (await response.json()) as { token?: string };

    if (!response.ok || typeof body.token !== 'string') {
      throw new Error('the proxy refused the proof');
    }

    return body.token;
  }
}

/**
 * The fetch the Anthropic client is built over: every request to the proxy
 * carries the current token, and a 401 buys one renewal and one retry —
 * enough for an expired token, and no loop for a broken one.
 */
export function attestedFetch(auth: ProxyAuth): typeof fetch {
  return async (input, init) => {
    const send = async (token: string) => {
      const headers = new Headers(init?.headers);

      headers.set('x-api-key', token);

      return fetch(input, { ...init, headers });
    };

    const first = await send(await auth.token());

    if (first.status !== 401) {
      return first;
    }

    return send(await auth.renew());
  };
}
