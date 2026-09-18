import type { ReminderPlan } from '@/domain/ports/IReminders';
import { ExpoReminders, type NotificationCenter } from '@/infrastructure/system/ExpoReminders';

/**
 * The phone's notifications as a list, with every call taking a tick the way
 * the native bridge does — which is what lets two plans interleave.
 */
class FakeCenter implements NotificationCenter {
  pending: Date[] = [];
  allows = true;

  async granted(): Promise<boolean> {
    await Promise.resolve();

    return this.allows;
  }

  async cancelAll(): Promise<void> {
    await Promise.resolve();
    this.pending = [];
  }

  async scheduleAt(date: Date): Promise<void> {
    await Promise.resolve();
    this.pending.push(date);
  }
}

const MORNING = new Date(2026, 8, 17, 10, 0);

function plan(overrides: Partial<ReminderPlan> = {}): ReminderPlan {
  return {
    at: { hour: 21, minute: 0 },
    text: { title: 'How are you today?', body: 'Say how the day went.' },
    now: MORNING,
    skipToday: false,
    ...overrides,
  };
}

function evenings(center: FakeCenter): readonly string[] {
  return center.pending.map((date) => date.toDateString()).sort();
}

describe('the evening reminder', () => {
  it('keeps one reminder an evening when two plans arrive at once', async () => {
    const center = new FakeCenter();
    const reminders = new ExpoReminders(center);

    // What opening the app does: the settings ask, and the journal loading a
    // moment later asks again before the first has finished.
    await Promise.all([reminders.schedule(plan()), reminders.schedule(plan())]);

    expect(evenings(center)).toHaveLength(8);
    expect(new Set(evenings(center)).size).toBe(8);
  });

  it('leaves the later plan standing, not a mix of the two', async () => {
    const center = new FakeCenter();
    const reminders = new ExpoReminders(center);

    await Promise.all([
      reminders.schedule(plan({ at: { hour: 21, minute: 0 } })),
      reminders.schedule(plan({ at: { hour: 8, minute: 30 }, now: new Date(2026, 8, 17, 7, 0) })),
    ]);

    expect(center.pending.every((date) => date.getHours() === 8 && date.getMinutes() === 30)).toBe(true);
    expect(center.pending).toHaveLength(8);
  });

  it('leaves nothing pending when the switch goes off right behind a plan', async () => {
    const center = new FakeCenter();
    const reminders = new ExpoReminders(center);

    await Promise.all([reminders.schedule(plan()), reminders.cancel()]);

    expect(center.pending).toHaveLength(0);
  });

  it('skips tonight once today is written, and a time already gone', async () => {
    const center = new FakeCenter();
    const reminders = new ExpoReminders(center);

    await reminders.schedule(plan({ skipToday: true }));
    expect(evenings(center)).toHaveLength(7);

    await reminders.schedule(plan({ now: new Date(2026, 8, 17, 22, 0) }));
    expect(evenings(center)).toHaveLength(7);
    expect(center.pending[0]?.getDate()).toBe(18);
  });

  it('says no, and schedules nothing, when the phone refuses', async () => {
    const center = new FakeCenter();
    const reminders = new ExpoReminders(center);

    center.allows = false;

    await expect(reminders.schedule(plan())).resolves.toBe(false);
    expect(center.pending).toHaveLength(0);
  });
});
