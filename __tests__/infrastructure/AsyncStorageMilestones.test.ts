import { Milestone } from '@/domain/entities/Milestone';
import { AsyncStorageMilestones } from '@/infrastructure/persistence/AsyncStorageMilestones';

import { InMemoryKeyValueStore } from './fakes';

const KEY = 'vidlun.milestones';

describe('milestones in storage', () => {
  it('come back as they went in, oldest first', async () => {
    const store = new InMemoryKeyValueStore();
    const subject = new AsyncStorageMilestones(store);
    const later = Milestone.create({ id: 'b', day: new Date(2026, 8, 1, 9), label: 'New job' });
    const earlier = Milestone.create({ id: 'a', day: new Date(2026, 6, 17, 23), label: 'Moved house' });

    await subject.save(later);
    await subject.save(earlier);

    expect(await new AsyncStorageMilestones(store).findAll()).toEqual([earlier, later]);
  });

  it('keeps the calendar day rather than an instant', async () => {
    const store = new InMemoryKeyValueStore();
    await new AsyncStorageMilestones(store).save(
      Milestone.create({ id: 'a', day: new Date(2026, 6, 17, 23, 59), label: 'Late' }),
    );

    expect(await store.getItem(KEY)).toContain('"day":"2026-07-17"');
  });

  it('replaces by id and deletes by id', async () => {
    const store = new InMemoryKeyValueStore();
    const subject = new AsyncStorageMilestones(store);
    await subject.save(Milestone.create({ id: 'a', day: new Date(2026, 6, 17), label: 'Move' }));

    await subject.save(Milestone.create({ id: 'a', day: new Date(2026, 6, 17), label: 'Moved house' }));
    expect((await subject.findAll()).map((m) => m.label)).toEqual(['Moved house']);

    await subject.delete('a');
    expect(await subject.findAll()).toEqual([]);
    expect(await store.getItem(KEY)).toBeNull();
  });

  it('skips records it cannot read rather than failing the whole line', async () => {
    const store = new InMemoryKeyValueStore();
    store.poison(
      KEY,
      JSON.stringify([
        { id: 'ok', day: '2026-07-17', label: 'Kept' },
        { id: 'bad-day', day: 'yesterday', label: 'Dropped' },
        { id: 'bad-label', day: '2026-07-18', label: '' },
        'not an object',
      ]),
    );

    expect((await new AsyncStorageMilestones(store).findAll()).map((m) => m.id)).toEqual(['ok']);
  });

  it('starts empty on a record that is not JSON', async () => {
    const store = new InMemoryKeyValueStore();
    store.poison(KEY, 'not json');

    expect(await new AsyncStorageMilestones(store).findAll()).toEqual([]);
  });
});
