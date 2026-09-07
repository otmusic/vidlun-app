import { Milestone } from '../../domain/entities/Milestone';
import type { IClock } from '../../domain/ports/IClock';
import type { IIdGenerator } from '../../domain/ports/IIdGenerator';
import type { IMilestoneRepository } from '../../domain/ports/IMilestoneRepository';

/**
 * Marks today, or renames a milestone already marked. Today rather than a
 * chosen date, as the drawing has it: a milestone is set the day it happens,
 * from the week that is on screen.
 */
export class MarkMilestone {
  constructor(
    private readonly repository: IMilestoneRepository,
    private readonly clock: IClock,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(label: string, id: string | null = null): Promise<Milestone> {
    const existing = id === null ? undefined : (await this.repository.findAll()).find((m) => m.id === id);
    const milestone =
      existing === undefined
        ? Milestone.create({ id: this.idGenerator.next(), day: this.clock.now(), label })
        : existing.withLabel(label);

    await this.repository.save(milestone);

    return milestone;
  }
}
