import {
  affirmationPeriodEnd,
  type AffirmationChoice,
  type KeptAffirmation,
} from '../../domain/entities/KeptAffirmation';
import type { AffirmationFrequency } from '../../domain/ports/IAffirmationReminders';
import type { IClock } from '../../domain/ports/IClock';
import type { IKeptAffirmations } from '../../domain/ports/IKeptAffirmations';

/**
 * Keeps the affirmation picked for as long as it was picked for (owner's
 * word, 2026-11-06): a day when they come daily, the week when weekly, the
 * month when monthly. The period is fixed at the pick, so changing how often
 * they come neither stretches nor cuts short one already picked.
 */
export class KeepAffirmation {
  constructor(
    private readonly store: IKeptAffirmations,
    private readonly clock: IClock,
  ) {}

  /** The affirmation still kept now, or null once its period is over. */
  async current(): Promise<KeptAffirmation | null> {
    const kept = await this.store.read();

    if (kept === null || this.clock.now().getTime() >= kept.until.getTime()) {
      return null;
    }

    return kept;
  }

  async keep(choice: AffirmationChoice, frequency: AffirmationFrequency): Promise<KeptAffirmation> {
    const pickedAt = this.clock.now();
    const kept: KeptAffirmation = {
      key: choice.key,
      text: choice.text,
      look: choice.look,
      frequency,
      pickedAt,
      until: affirmationPeriodEnd(pickedAt, frequency),
    };

    await this.store.write(kept);

    return kept;
  }
}
