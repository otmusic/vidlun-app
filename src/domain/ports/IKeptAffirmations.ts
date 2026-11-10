import type { KeptAffirmation } from '../entities/KeptAffirmation';

/** The one affirmation picked last; a new pick takes its place. */
export interface IKeptAffirmations {
  read(): Promise<KeptAffirmation | null>;
  write(kept: KeptAffirmation): Promise<void>;
}
