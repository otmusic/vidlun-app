import { ExpoAffirmationReminders } from '@/infrastructure/system/ExpoAffirmationReminders';
import { FakeNotificationCenter } from './fakes';

const TEXT = { title: 'An affirmation is waiting', body: 'Pick one of five cards.' };

describe('the affirmation notification', () => {
  it('comes every morning at ten when it is daily', async () => {
    const center = new FakeNotificationCenter();

    await new ExpoAffirmationReminders(center).schedule({ frequency: 'daily', text: TEXT });

    expect(center.repeating).toEqual([{ hour: 10, minute: 0 }]);
    expect(center.texts).toEqual([TEXT]);
  });

  it('comes on Monday mornings when it is weekly', async () => {
    const center = new FakeNotificationCenter();

    await new ExpoAffirmationReminders(center).schedule({ frequency: 'weekly', text: TEXT });

    // The phone counts Sunday as 1, so Monday is 2.
    expect(center.repeating).toEqual([{ hour: 10, minute: 0, weekday: 2 }]);
  });

  it('comes on the first of the month when it is monthly, whatever day that is', async () => {
    const center = new FakeNotificationCenter();

    await new ExpoAffirmationReminders(center).schedule({ frequency: 'monthly', text: TEXT });

    expect(center.repeating).toEqual([{ hour: 10, minute: 0, day: 1 }]);
  });

  it('keeps one rule when the frequency changes, not one of each', async () => {
    const center = new FakeNotificationCenter();
    const affirmations = new ExpoAffirmationReminders(center);

    await affirmations.schedule({ frequency: 'daily', text: TEXT });
    await affirmations.schedule({ frequency: 'monthly', text: TEXT });

    expect(center.repeating).toHaveLength(1);
  });

  it('leaves the evening reminders alone, and they it', async () => {
    const center = new FakeNotificationCenter();
    const affirmations = new ExpoAffirmationReminders(center);

    await center.scheduleAt(new Date(2026, 10, 9, 21, 0), TEXT);
    await affirmations.schedule({ frequency: 'weekly', text: TEXT });
    await affirmations.cancel();

    expect(center.pending).toHaveLength(1);
    expect(center.repeating).toHaveLength(0);
  });

  it('says no, and schedules nothing, when the phone refuses', async () => {
    const center = new FakeNotificationCenter();

    center.allows = false;

    await expect(
      new ExpoAffirmationReminders(center).schedule({ frequency: 'weekly', text: TEXT }),
    ).resolves.toBe(false);
    expect(center.repeating).toHaveLength(0);
  });
});
