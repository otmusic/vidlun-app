import type { AffirmationFrequency } from '../ports/IAffirmationReminders';

/**
 * How the picked one looked: its shape, its colour and its glyph, kept so it
 * comes back the way it was drawn. Opaque here; only the page that drew it
 * reads it.
 */
export interface AffirmationLook {
  readonly shape: string;
  readonly tint: number;
  readonly glyph: string;
}

/** The one of five the person picked. */
export interface AffirmationChoice {
  /** Its key in the list. */
  readonly key: string;
  /**
   * The words as they were shown, in the language they were shown in. Kept
   * rather than looked up again, so a list rewritten later cannot change
   * what someone already picked.
   */
  readonly text: string;
  readonly look: AffirmationLook;
}

/**
 * The affirmation picked for this day, week or month (owner's word,
 * 2026-11-06): it stays the person's until the period it was picked for is
 * over, opened again from the journal, and the morning notification shows it
 * rather than five new ones.
 */
export interface KeptAffirmation extends AffirmationChoice {
  /** How often it came when it was picked, which is the period it covers. */
  readonly frequency: AffirmationFrequency;
  readonly pickedAt: Date;
  /** The first moment it is no longer kept: the next day, Monday or month. */
  readonly until: Date;
}

const DAYS_IN_WEEK = 7;

/**
 * Where the period a moment falls in ends, in local time: midnight, the
 * coming Monday, or the first of next month. Weeks run Monday to Sunday, as
 * everywhere else in the app.
 */
export function affirmationPeriodEnd(at: Date, frequency: AffirmationFrequency): Date {
  if (frequency === 'monthly') {
    return new Date(at.getFullYear(), at.getMonth() + 1, 1);
  }

  if (frequency === 'weekly') {
    const daysSinceMonday = (at.getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;

    return new Date(at.getFullYear(), at.getMonth(), at.getDate() - daysSinceMonday + DAYS_IN_WEEK);
  }

  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
}
