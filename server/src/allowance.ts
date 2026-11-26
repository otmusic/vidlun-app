/**
 * How much one installed app may ask for in a day.
 *
 * The rate limiter counts a minute at a time, which still left a single token
 * worth some forty thousand calls a day (security review, 2026-11-26). A
 * person writing a journal makes a handful: an entry is one reflection, a
 * month one narrative, and a backlog of entries saved offline a few dozen at
 * most. The allowance sits far above that and far below anything worth
 * stealing a token for.
 *
 * One Durable Object per attested key, so the count is exact and its own: a
 * key is a single install, and nothing in it says who the person is. It holds
 * one row — today's counts — and replaces it when the day changes, so it never
 * grows.
 */

/** Per key, per UTC day. */
export const DAILY_ALLOWANCE = {
  haiku: 100,
  sonnet: 30,
  feedback: 10,
} as const;

export type AllowanceKind = keyof typeof DAILY_ALLOWANCE;

/** The slice of Cloudflare's Durable Object state this class uses. */
interface AllowanceState {
  readonly storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };
}

/** The slice of a Durable Object namespace binding the worker uses. */
export interface AllowanceNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string): Promise<Response> };
}

interface Today {
  readonly day: string;
  readonly counts: Readonly<Partial<Record<AllowanceKind, number>>>;
}

/** Takes one from today's allowance of `kind` for this key; false when it is spent. */
export async function takeFromAllowance(
  namespace: AllowanceNamespace,
  keyId: string,
  kind: AllowanceKind,
): Promise<boolean> {
  const stub = namespace.get(namespace.idFromName(keyId));
  const answer = await stub.fetch(`https://allowance/take?kind=${kind}`);

  return answer.status === 200;
}

export class Allowance {
  constructor(private readonly state: AllowanceState) {}

  /*
   * Storage calls on a Durable Object hold its input gate, so a read and the
   * write after it are not interleaved with another request's: two calls in
   * the same instant cannot both take the last one.
   */
  async fetch(request: Request): Promise<Response> {
    const kind = new URL(request.url).searchParams.get('kind');

    if (kind === null || !(kind in DAILY_ALLOWANCE)) {
      return new Response('unknown kind', { status: 400 });
    }

    const allowanceKind = kind as AllowanceKind;
    const day = new Date().toISOString().slice(0, 10);
    const stored = await this.state.storage.get<Today>('today');
    const today: Today = stored !== undefined && stored.day === day ? stored : { day, counts: {} };
    const used = today.counts[allowanceKind] ?? 0;

    if (used >= DAILY_ALLOWANCE[allowanceKind]) {
      return new Response('spent', { status: 429 });
    }

    await this.state.storage.put<Today>('today', { day, counts: { ...today.counts, [allowanceKind]: used + 1 } });

    return new Response('ok', { status: 200 });
  }
}
