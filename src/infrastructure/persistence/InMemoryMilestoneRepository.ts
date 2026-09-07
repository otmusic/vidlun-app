import type { Milestone } from '../../domain/entities/Milestone';
import type { IMilestoneRepository } from '../../domain/ports/IMilestoneRepository';

/** For tests, and interchangeable with the stored one in every one of them. */
export class InMemoryMilestoneRepository implements IMilestoneRepository {
  private readonly items = new Map<string, Milestone>();

  findAll(): Promise<readonly Milestone[]> {
    return Promise.resolve(
      [...this.items.values()].sort((a, b) => a.day.getTime() - b.day.getTime()),
    );
  }

  save(milestone: Milestone): Promise<void> {
    this.items.set(milestone.id, milestone);

    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.items.delete(id);

    return Promise.resolve();
  }
}
