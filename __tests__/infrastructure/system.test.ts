import { ExpoMicrophonePermission } from '@/infrastructure/audio/ExpoMicrophonePermission';
import { IntervalScheduler } from '@/infrastructure/system/IScheduler';
import { SystemClock } from '@/infrastructure/system/SystemClock';
import { UuidGenerator, type RandomSource } from '@/infrastructure/system/UuidGenerator';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UuidGenerator', () => {
  it('uses the platform generator when there is one', () => {
    const random: RandomSource = { randomUUID: () => 'platform-uuid' };

    expect(new UuidGenerator(random).next()).toBe('platform-uuid');
  });

  it('builds a version 4 id from random bytes when there is no generator', () => {
    const random: RandomSource = {
      getRandomValues: (array) => {
        array.fill(0xff);

        return array;
      },
    };

    const id = new UuidGenerator(random).next();

    expect(id).toMatch(UUID_V4);
  });

  it('still produces usable ids on a runtime with no crypto at all', () => {
    // Passing `undefined` would fall back to the default parameter and quietly
    // test the platform generator again; an empty source is the real absence.
    const generator = new UuidGenerator({});
    const ids = new Set(Array.from({ length: 100 }, () => generator.next()));

    expect([...ids].every((id) => UUID_V4.test(id))).toBe(true);
    expect(ids.size).toBe(100);
  });
});

describe('IntervalScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('repeats until it is told to stop', () => {
    const tick = jest.fn();
    const stop = new IntervalScheduler().every(100, tick);

    jest.advanceTimersByTime(350);
    expect(tick).toHaveBeenCalledTimes(3);

    stop();
    jest.advanceTimersByTime(500);
    expect(tick).toHaveBeenCalledTimes(3);
  });
});

describe('SystemClock', () => {
  it('reads the wall clock', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('ExpoMicrophonePermission', () => {
  function api(response: { granted: boolean; canAskAgain: boolean }) {
    return {
      getRecordingPermissionsAsync: () => Promise.resolve(response),
      requestRecordingPermissionsAsync: () => Promise.resolve(response),
    };
  }

  it('reports a granted microphone', async () => {
    const permission = new ExpoMicrophonePermission(api({ granted: true, canAskAgain: false }));

    expect(await permission.status()).toBe('granted');
    expect(await permission.request()).toBe('granted');
  });

  it('separates "has not been asked" from "said no"', async () => {
    const unasked = new ExpoMicrophonePermission(api({ granted: false, canAskAgain: true }));
    const refused = new ExpoMicrophonePermission(api({ granted: false, canAskAgain: false }));

    expect(await unasked.status()).toBe('undetermined');
    expect(await refused.status()).toBe('denied');
  });
});
