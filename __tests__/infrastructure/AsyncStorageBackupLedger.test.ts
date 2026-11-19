import { AsyncStorageBackupLedger } from '@/infrastructure/persistence/AsyncStorageBackupLedger';

import { InMemoryKeyValueStore } from './fakes';

describe('the last backup handed over', () => {
  it('is nothing before the first', async () => {
    expect(await new AsyncStorageBackupLedger(new InMemoryKeyValueStore()).last()).toBeNull();
  });

  it('keeps the moment, and the newest one wins', async () => {
    const ledger = new AsyncStorageBackupLedger(new InMemoryKeyValueStore());

    await ledger.record(new Date(2026, 10, 12, 9, 0));
    await ledger.record(new Date(2026, 10, 19, 20, 30));

    expect((await ledger.last())?.getTime()).toBe(new Date(2026, 10, 19, 20, 30).getTime());
  });

  it('reads something unreadable as no backup yet', async () => {
    const store = new InMemoryKeyValueStore();

    await store.setItem('vidlun.lastBackup', 'not a date');

    expect(await new AsyncStorageBackupLedger(store).last()).toBeNull();
  });
});
