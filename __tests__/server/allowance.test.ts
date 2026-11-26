import { Allowance, DAILY_ALLOWANCE } from '../../server/src/allowance';

class MemoryStorage {
  private readonly rows = new Map<string, unknown>();

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.rows.get(key) as T | undefined);
  }

  put<T>(key: string, value: T): Promise<void> {
    this.rows.set(key, value);

    return Promise.resolve();
  }

  get size(): number {
    return this.rows.size;
  }
}

function take(allowance: Allowance, kind: string): Promise<number> {
  return allowance.fetch(new Request(`https://allowance/take?kind=${kind}`)).then((answer) => answer.status);
}

describe("one install's daily allowance", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives out the calls of the day and then refuses, each kind on its own', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T10:00:00Z'));
    const allowance = new Allowance({ storage: new MemoryStorage() });

    for (let call = 0; call < DAILY_ALLOWANCE.sonnet; call += 1) {
      expect(await take(allowance, 'sonnet')).toBe(200);
    }

    expect(await take(allowance, 'sonnet')).toBe(429);
    expect(await take(allowance, 'haiku')).toBe(200);
  });

  it('starts again the next day and keeps a single row', async () => {
    const storage = new MemoryStorage();
    const allowance = new Allowance({ storage });

    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T23:59:00Z'));

    for (let call = 0; call < DAILY_ALLOWANCE.feedback; call += 1) {
      await take(allowance, 'feedback');
    }

    expect(await take(allowance, 'feedback')).toBe(429);

    jest.setSystemTime(new Date('2026-11-27T00:01:00Z'));

    expect(await take(allowance, 'feedback')).toBe(200);
    expect(storage.size).toBe(1);
  });

  it('refuses a kind it does not know', async () => {
    const allowance = new Allowance({ storage: new MemoryStorage() });

    expect(await take(allowance, 'opus')).toBe(400);
  });
});
