import { ForgetMilestone } from '@/application/use-cases/ForgetMilestone';
import { GetMilestones } from '@/application/use-cases/GetMilestones';
import { MarkMilestone } from '@/application/use-cases/MarkMilestone';
import { Milestone } from '@/domain/entities/Milestone';
import { InMemoryMilestoneRepository } from '@/infrastructure/persistence/InMemoryMilestoneRepository';

import { FixedClock, SequentialIdGenerator } from './fakes';

const TODAY = new Date(2026, 8, 7, 15, 10);

function setup() {
  const repository = new InMemoryMilestoneRepository();

  return {
    repository,
    mark: new MarkMilestone(repository, new FixedClock(TODAY), new SequentialIdGenerator()),
    forget: new ForgetMilestone(repository),
    list: new GetMilestones(repository),
  };
}

describe('marking milestones', () => {
  it('marks today with a fresh id', async () => {
    const { mark, list } = setup();

    const marked = await mark.execute('Moved house');

    expect(marked.day).toEqual(new Date(2026, 8, 7));
    expect(marked.label).toBe('Moved house');
    expect(await list.execute()).toEqual([marked]);
  });

  it('renames a milestone without moving it', async () => {
    const { repository, mark, list } = setup();
    await repository.save(Milestone.create({ id: 'old', day: new Date(2026, 6, 17), label: 'Move' }));

    await mark.execute('Moved house', 'old');

    expect(await list.execute()).toEqual([
      Milestone.create({ id: 'old', day: new Date(2026, 6, 17), label: 'Moved house' }),
    ]);
  });

  it('marks a new one when the id it was given is gone', async () => {
    const { mark, list } = setup();

    await mark.execute('New job', 'vanished');

    expect((await list.execute()).map((m) => m.label)).toEqual(['New job']);
  });

  it('lists oldest first, whatever order they were marked in', async () => {
    const { repository, list } = setup();
    await repository.save(Milestone.create({ id: 'b', day: new Date(2026, 8, 1), label: 'Later' }));
    await repository.save(Milestone.create({ id: 'a', day: new Date(2026, 6, 17), label: 'Earlier' }));

    expect((await list.execute()).map((m) => m.label)).toEqual(['Earlier', 'Later']);
  });

  it('forgets one and leaves the rest', async () => {
    const { mark, forget, list } = setup();
    const kept = await mark.execute('Kept');
    const gone = await mark.execute('Gone');

    await forget.execute(gone.id);
    await forget.execute(gone.id);

    expect(await list.execute()).toEqual([kept]);
  });
});
