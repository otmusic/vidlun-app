import type { Milestone } from '../../domain/entities/Milestone';
import type { IMilestoneRepository } from '../../domain/ports/IMilestoneRepository';

/** Every milestone, oldest first: the whole line, for the strip, the chart and the journal. */
export class GetMilestones {
  constructor(private readonly repository: IMilestoneRepository) {}

  execute(): Promise<readonly Milestone[]> {
    return this.repository.findAll();
  }
}
