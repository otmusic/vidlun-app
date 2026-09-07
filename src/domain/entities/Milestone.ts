import { InvalidMilestoneLabelError } from '../errors/MilestoneErrors';

export interface MilestoneProps {
  readonly id: string;
  readonly day: Date;
  readonly label: string;
}

/** Two or three words, as the drawing's field allows; a milestone is a name, not a note. */
export const MILESTONE_LABEL_MAX = 24;

/**
 * An event the person marks on their own timeline — a move, a new job, a
 * break-up — so the entries around it read as before and after. It carries
 * no emotion, no text and no colour of its own: it is a place on the line,
 * and the entries say how it felt.
 */
export class Milestone {
  private constructor(
    readonly id: string,
    /** Local midnight: a milestone marks a day, not a moment. */
    readonly day: Date,
    readonly label: string,
  ) {}

  static create(props: MilestoneProps): Milestone {
    const label = props.label.trim();

    if (label.length === 0 || label.length > MILESTONE_LABEL_MAX) {
      throw new InvalidMilestoneLabelError(label.length, MILESTONE_LABEL_MAX);
    }

    return new Milestone(props.id, startOfDay(props.day), label);
  }

  withLabel(label: string): Milestone {
    return Milestone.create({ id: this.id, day: this.day, label });
  }

  /** True when this milestone marks the day the date falls on. */
  marks(date: Date): boolean {
    return startOfDay(date).getTime() === this.day.getTime();
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
