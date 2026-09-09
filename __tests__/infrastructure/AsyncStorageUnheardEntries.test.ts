import { AsyncStorageUnheardEntries } from '@/infrastructure/persistence/AsyncStorageUnheardEntries';

import { InMemoryKeyValueStore } from './fakes';

describe('the ids waiting to be heard', () => {
  it('keeps them in the order they were added, once each', async () => {
    const unheard = new AsyncStorageUnheardEntries(new InMemoryKeyValueStore());

    await unheard.add('e1');
    await unheard.add('e2');
    await unheard.add('e1');

    expect(await unheard.ids()).toEqual(['e1', 'e2']);
  });

  it('crosses one off without touching the others, and clears the key when empty', async () => {
    const store = new InMemoryKeyValueStore();
    const unheard = new AsyncStorageUnheardEntries(store);

    await unheard.add('e1');
    await unheard.add('e2');
    await unheard.remove('e1');

    expect(await unheard.ids()).toEqual(['e2']);

    await unheard.remove('e2');
    await unheard.remove('never-there');

    expect(await unheard.ids()).toEqual([]);
    expect(await store.getItem('vidlun.unheardEntries')).toBeNull();
  });

  it('does not lose an id added while another is being crossed off', async () => {
    const unheard = new AsyncStorageUnheardEntries(new InMemoryKeyValueStore());

    await unheard.add('e1');
    await Promise.all([unheard.remove('e1'), unheard.add('e2'), unheard.add('e3')]);

    expect(await unheard.ids()).toEqual(['e2', 'e3']);
  });

  it('treats an unreadable record as nothing waiting', async () => {
    const store = new InMemoryKeyValueStore();

    await store.setItem('vidlun.unheardEntries', '{not a list');

    expect(await new AsyncStorageUnheardEntries(store).ids()).toEqual([]);

    await store.setItem('vidlun.unheardEntries', JSON.stringify(['e1', 7, null]));

    expect(await new AsyncStorageUnheardEntries(store).ids()).toEqual(['e1']);
  });
});
