import { protectAppDataOnce } from '@/infrastructure/files/DataProtection';

import { InMemoryKeyValueStore } from './fakes';

describe('moving the files already written to the protected class', () => {
  it('runs once, and not again on later launches', async () => {
    const store = new InMemoryKeyValueStore();
    let passes = 0;
    const native = {
      protectAppData: () => {
        passes += 1;

        return Promise.resolve(12);
      },
    };

    await protectAppDataOnce(native, store);
    await protectAppDataOnce(native, store);

    expect(passes).toBe(1);
  });

  it('tries again next launch when the pass failed', async () => {
    const store = new InMemoryKeyValueStore();
    let passes = 0;
    const failing = {
      protectAppData: () => {
        passes += 1;

        return Promise.reject(new Error('refused'));
      },
    };

    await expect(protectAppDataOnce(failing, store)).rejects.toThrow('refused');
    await expect(protectAppDataOnce(failing, store)).rejects.toThrow('refused');

    expect(passes).toBe(2);
  });

  it('does nothing in a build without the native module', async () => {
    await expect(protectAppDataOnce(null, new InMemoryKeyValueStore())).resolves.toBeUndefined();
  });
});
