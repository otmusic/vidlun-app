import { DeadlinePassedError, withinDeadline } from '@/presentation/withinDeadline';

describe('the wait for a reading', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hands over an answer that comes in time', async () => {
    const answer = withinDeadline(Promise.resolve('reading'), 8_000);

    await expect(answer).resolves.toBe('reading');
  });

  it('ends the wait when the deadline passes first', async () => {
    const never = new Promise<string>(() => undefined);
    const answer = withinDeadline(never, 8_000);

    jest.advanceTimersByTime(8_000);

    await expect(answer).rejects.toBeInstanceOf(DeadlinePassedError);
  });

  it('passes on a failure that comes before the deadline', async () => {
    const answer = withinDeadline(Promise.reject(new Error('offline')), 8_000);

    await expect(answer).rejects.toThrow('offline');
  });
});
