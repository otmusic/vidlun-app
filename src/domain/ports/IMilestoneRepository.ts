import type { Milestone } from '../entities/Milestone';

export interface IMilestoneRepository {
  /** Every milestone, oldest first. */
  findAll(): Promise<readonly Milestone[]>;
  /** Saves a new milestone, or replaces the one with the same id. */
  save(milestone: Milestone): Promise<void>;
  /** Silent when there is no such milestone: deleting twice is not an error. */
  delete(id: string): Promise<void>;
}
