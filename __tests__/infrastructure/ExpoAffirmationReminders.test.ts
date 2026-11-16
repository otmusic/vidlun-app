import {
  affirmationMornings,
  ExpoAffirmationReminders,
} from '@/infrastructure/system/ExpoAffirmationReminders';
import { FakeNotificationCenter } from './fakes';

const TEXT = { title: 'An affirmation is waiting', body: 'Pick one of five cards.' };

// Wednesday, 18 November 2026, at eight in the morning.
const WEDNESDAY = new Date(2026, 10, 18, 8, 0);

function plan(frequency: 'daily' | 'weekly' | 'monthly', quietUntil: Date | null = null) {
  return { frequency, text: TEXT, from: WEDNESDAY, quietUntil };
}

describe('the affirmation mornings', () => {
  it('come every morning at ten when it is daily, starting today', () => {
    const mornings = affirmationMornings('daily', WEDNESDAY, null);

    expect(mornings[0]).toEqual(new Date(2026, 10, 18, 10, 0));
    expect(mornings[1]).toEqual(new Date(2026, 10, 19, 10, 0));
    expect(mornings).toHaveLength(14);
  });

  it('come on Monday mornings when it is weekly', () => {
    const mornings = affirmationMornings('weekly', WEDNESDAY, null);

    expect(mornings[0]).toEqual(new Date(2026, 10, 23, 10, 0));
    expect(mornings.every((morning) => morning.getDay() === 1)).toBe(true);
  });

  it('come on the first of the month when it is monthly, whatever day that is', () => {
    const mornings = affirmationMornings('monthly', WEDNESDAY, null);

    expect(mornings.slice(0, 2)).toEqual([new Date(2026, 11, 1, 10, 0), new Date(2027, 0, 1, 10, 0)]);
  });

  it('skip a morning that has already gone today', () => {
    expect(affirmationMornings('daily', new Date(2026, 10, 18, 11, 0), null)[0]).toEqual(
      new Date(2026, 10, 19, 10, 0),
    );
  });

  /*
   * Owner's word, 2026-11-16: once this period's affirmation is picked, its
   * morning does not ask for one again.
   */
  it('leave out the mornings of a period already picked for', () => {
    // Picked early on Monday the 16th, kept through Sunday night.
    const mornings = affirmationMornings('weekly', new Date(2026, 10, 16, 8, 0), new Date(2026, 10, 23));

    expect(mornings[0]).toEqual(new Date(2026, 10, 23, 10, 0));
  });

  it('leave out only today when today’s is picked and they come daily', () => {
    const mornings = affirmationMornings('daily', WEDNESDAY, new Date(2026, 10, 19));

    expect(mornings[0]).toEqual(new Date(2026, 10, 19, 10, 0));
  });
});

describe('the affirmation notification', () => {
  it('schedules the mornings ahead with the words it was given', async () => {
    const center = new FakeNotificationCenter();

    await expect(new ExpoAffirmationReminders(center).schedule(plan('weekly'))).resolves.toBe(true);

    expect(center.affirmations).toEqual(affirmationMornings('weekly', WEDNESDAY, null));
    expect(center.texts.every((text) => text === TEXT)).toBe(true);
  });

  it('replaces the mornings when the frequency changes, rather than adding to them', async () => {
    const center = new FakeNotificationCenter();
    const affirmations = new ExpoAffirmationReminders(center);

    await affirmations.schedule(plan('daily'));
    await affirmations.schedule(plan('monthly'));

    expect(center.affirmations).toEqual(affirmationMornings('monthly', WEDNESDAY, null));
  });

  it('keeps one set when two schedules run side by side', async () => {
    const center = new FakeNotificationCenter();
    const affirmations = new ExpoAffirmationReminders(center);

    await Promise.all([affirmations.schedule(plan('daily')), affirmations.schedule(plan('daily', new Date(2026, 10, 19)))]);

    expect(center.affirmations).toEqual(affirmationMornings('daily', WEDNESDAY, new Date(2026, 10, 19)));
  });

  it('leaves the evening reminders alone, and they it', async () => {
    const center = new FakeNotificationCenter();
    const affirmations = new ExpoAffirmationReminders(center);

    await center.scheduleAt(new Date(2026, 10, 18, 21, 0), TEXT);
    await affirmations.schedule(plan('weekly'));
    await affirmations.cancel();

    expect(center.pending).toHaveLength(1);
    expect(center.affirmations).toHaveLength(0);
  });

  it('says no, and schedules nothing, when the phone refuses', async () => {
    const center = new FakeNotificationCenter();

    center.allows = false;

    await expect(new ExpoAffirmationReminders(center).schedule(plan('weekly'))).resolves.toBe(false);
    expect(center.affirmations).toHaveLength(0);
  });
});
