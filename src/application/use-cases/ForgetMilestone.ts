import type { IMilestoneRepository } from '../../domain/ports/IMilestoneRepository';

/** Removes a milestone. The entries around it stay exactly as they were. */
export class ForgetMilestone {
  constructor(private readonly repository: IMilestoneRepository) {}

  execute(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
