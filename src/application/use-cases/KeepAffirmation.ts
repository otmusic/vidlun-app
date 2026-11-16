import {
  affirmationPeriodEnd,
  type AffirmationChoice,
  type KeptAffirmation,
} from '../../domain/entities/KeptAffirmation';
import type { AffirmationFrequency } from '../../domain/ports/IAffirmationReminders';
import type { IClock } from '../../domain/ports/IClock';
import type { IKeptAffirmations } from '../../domain/ports/IKeptAffirmations';

/**
 * Keeps the affirmation picked for its period (owner's word, 2026-11-06): a
 * day when they come daily, the week when weekly, the month when monthly.
 *
 * The period follows how often they come now, not when it was picked
 * (owner's bug, 2026-11-16): picked for the week and switched to daily, the
 * next morning's notification opened on last week's pick with no way to
 * choose a new one. Measured from the moment it was picked, so switching
 * the other way keeps today's pick to the end of the week.
 */
export class KeepAffirmation {
  constructor(
    private readonly store: IKeptAffirmations,
    private readonly clock: IClock,
  ) {}

  /**
   * The affirmation still kept now, or null once its period is over. Given
   * how often they come now, the period is that one's; without it, the one
   * it was picked under.
   */
  async current(frequency?: AffirmationFrequency): Promise<KeptAffirmation | null> {
    const stored = await this.store.read();

    if (stored === null) {
      return null;
    }

    const kept =
      frequency === undefined || frequency === stored.frequency
        ? stored
        : { ...stored, frequency, until: affirmationPeriodEnd(stored.pickedAt, frequency) };

    return this.clock.now().getTime() >= kept.until.getTime() ? null : kept;
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
