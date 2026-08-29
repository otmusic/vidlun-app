/**
 * Who may use this proxy: a key born inside a genuine build of Vidlun on a
 * genuine iPhone, and nothing else.
 *
 * The old scheme shipped a bearer token in the app bundle, and anything in a
 * bundle can be read out of it. App Attest replaces that with a key the
 * Secure Enclave will not export: Apple signs a one-time attestation that the
 * key belongs to this app on real hardware, we verify that signature once,
 * and afterwards the device proves itself with assertions. What we hand back
 * is a short-lived token, so the expensive proof happens once a day and not
 * once a request.
 */
import { Buffer } from 'node:buffer';

import { verifyAttestation, verifyAssertion } from 'node-app-attest';

/** The app this proxy serves. An attestation for anything else is refused. */
const BUNDLE_IDENTIFIER = 'com.vidlun.journal';
const TEAM_IDENTIFIER = 'M3K99W5FFQ';

/**
 * Development builds attest against Apple's sandbox. True until the App
 * Store build exists; the flag stays here so turning it off is one line.
 */
const ALLOW_DEVELOPMENT = true;

/** A challenge is asked for, used within minutes, and never reused. */
const CHALLENGE_TTL_SECONDS = 300;

/** How long a proof of device is trusted before a fresh assertion is asked. */
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export interface AttestStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface KeyRecord {
  readonly publicKey: string;
  readonly signCount: number;
}

/** Random, single-use, remembered only long enough to be answered. */
export async function issueChallenge(store: AttestStore): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const challenge = toHex(bytes);

  await store.put(`challenge:${challenge}`, '1', { expirationTtl: CHALLENGE_TTL_SECONDS });

  return challenge;
}

/** True exactly once per issued challenge. */
async function consumeChallenge(store: AttestStore, challenge: string): Promise<boolean> {
  const found = await store.get(`challenge:${challenge}`);

  if (found === null) {
    return false;
  }

  await store.delete(`challenge:${challenge}`);

  return true;
}

/**
 * The one-time ceremony: Apple's certificate chain says this key was made by
 * this app on real hardware. The public key is kept; everything after this
 * is an ordinary signature check.
 */
export async function register(
  store: AttestStore,
  input: { readonly keyId: string; readonly attestation: string; readonly challenge: string },
): Promise<boolean> {
  if (!(await consumeChallenge(store, input.challenge))) {
    return false;
  }

  const { publicKey } = verifyAttestation({
    attestation: Buffer.from(input.attestation, 'base64'),
    challenge: input.challenge,
    keyId: input.keyId,
    bundleIdentifier: BUNDLE_IDENTIFIER,
    teamIdentifier: TEAM_IDENTIFIER,
    allowDevelopmentEnvironment: ALLOW_DEVELOPMENT,
  });

  const record: KeyRecord = { publicKey, signCount: 0 };

  await store.put(`key:${input.keyId}`, JSON.stringify(record));

  return true;
}

/**
 * The everyday proof: a signature over a fresh challenge, checked against the
 * key we verified once. The counter only ever goes up, so a cloned key that
 * reuses an old count gives itself away.
 */
export async function assertKey(
  store: AttestStore,
  input: { readonly keyId: string; readonly assertion: string; readonly challenge: string },
): Promise<boolean> {
  if (!(await consumeChallenge(store, input.challenge))) {
    return false;
  }

  const raw = await store.get(`key:${input.keyId}`);

  if (raw === null) {
    return false;
  }

  const record = JSON.parse(raw) as KeyRecord;

  const { signCount } = verifyAssertion({
    assertion: Buffer.from(input.assertion, 'base64'),
    payload: input.challenge,
    publicKey: record.publicKey,
    bundleIdentifier: BUNDLE_IDENTIFIER,
    teamIdentifier: TEAM_IDENTIFIER,
    signCount: record.signCount,
  });

  await store.put(`key:${input.keyId}`, JSON.stringify({ ...record, signCount }));

  return true;
}

/** `v1.<keyId>.<expiry>.<mac>` — self-contained, so checking it costs no read. */
export async function mintToken(secret: string, keyId: string, now: number): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
  const body = `${base64url(keyId)}.${expiresAt}`;

  return `v1.${body}.${await mac(secret, body)}`;
}

/** The keyId inside a valid, unexpired token, or null. */
export async function readToken(
  secret: string,
  token: string,
  now: number,
): Promise<string | null> {
  const parts = token.split('.');

  if (parts.length !== 4 || parts[0] !== 'v1') {
    return null;
  }

  const [, keyPart, expiryPart, givenMac] = parts;
  const body = `${keyPart}.${expiryPart}`;

  if (!timingSafeEqual(await mac(secret, body), givenMac ?? '')) {
    return null;
  }

  if (Number(expiryPart) * 1000 < now) {
    return null;
  }

  return fromBase64url(keyPart ?? '');
}

async function mac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));

  return base64url(String.fromCharCode(...new Uint8Array(signature)));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): string {
  return atob(text.replace(/-/g, '+').replace(/_/g, '/'));
}
