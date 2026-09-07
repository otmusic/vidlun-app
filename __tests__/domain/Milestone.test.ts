import { MILESTONE_LABEL_MAX, Milestone } from '@/domain/entities/Milestone';
import { InvalidMilestoneLabelError } from '@/domain/errors/MilestoneErrors';

const NOON = new Date(2026, 8, 7, 12, 30);

describe('Milestone', () => {
  it('keeps the day, not the moment', () => {
    const milestone = Milestone.create({ id: 'm1', day: NOON, label: 'Moved house' });

    expect(milestone.day).toEqual(new Date(2026, 8, 7));
    expect(milestone.marks(new Date(2026, 8, 7, 23, 59))).toBe(true);
    expect(milestone.marks(new Date(2026, 8, 8, 0, 0))).toBe(false);
  });

  it('trims the label and refuses an empty one', () => {
    expect(Milestone.create({ id: 'm1', day: NOON, label: '  New job  ' }).label).toBe('New job');
    expect(() => Milestone.create({ id: 'm1', day: NOON, label: '   ' })).toThrow(InvalidMilestoneLabelError);
  });

  it('holds the label to the width of the drawing', () => {
    const atMost = 'x'.repeat(MILESTONE_LABEL_MAX);

    expect(Milestone.create({ id: 'm1', day: NOON, label: atMost }).label).toBe(atMost);
    expect(() => Milestone.create({ id: 'm1', day: NOON, label: `${atMost}y` })).toThrow(
      InvalidMilestoneLabelError,
    );
  });

  it('renames without moving', () => {
    const renamed = Milestone.create({ id: 'm1', day: NOON, label: 'Move' }).withLabel('Moved house');

    expect(renamed.id).toBe('m1');
    expect(renamed.day).toEqual(new Date(2026, 8, 7));
    expect(renamed.label).toBe('Moved house');
  });
});
