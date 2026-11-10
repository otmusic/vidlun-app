import { KeepAffirmation } from '@/application/use-cases/KeepAffirmation';
import type { KeptAffirmation } from '@/domain/entities/KeptAffirmation';
import type { IKeptAffirmations } from '@/domain/ports/IKeptAffirmations';
import { FixedClock } from './fakes';

class InMemoryKeptAffirmations implements IKeptAffirmations {
  kept: KeptAffirmation | null = null;

  read(): Promise<KeptAffirmation | null> {
    return Promise.resolve(this.kept);
  }

  write(kept: KeptAffirmation): Promise<void> {
    this.kept = kept;

    return Promise.resolve();
  }
}

const CHOICE = {
  key: 'affirmation.say3',
  text: 'Slow is still forward.',
  look: { shape: 'cloud', tint: 3, glyph: 'sun' },
};

describe('KeepAffirmation', () => {
  // Monday, 9 November 2026, mid-morning: when the weekly one arrives.
  const monday = new Date(2026, 10, 9, 10, 5);

  function setUp(): { keep: KeepAffirmation; clock: FixedClock; store: InMemoryKeptAffirmations } {
    const clock = new FixedClock(monday);
    const store = new InMemoryKeptAffirmations();

    return { keep: new KeepAffirmation(store, clock), clock, store };
  }

  it('has nothing before anything was picked', async () => {
    const { keep } = setUp();

    expect(await keep.current()).toBeNull();
  });

  it('keeps the words, the look and the period of the pick', async () => {
    const { keep } = setUp();

    const kept = await keep.keep(CHOICE, 'weekly');

    expect(kept).toEqual({
      ...CHOICE,
      frequency: 'weekly',
      pickedAt: monday,
      until: new Date(2026, 10, 16),
    });
    expect(await keep.current()).toEqual(kept);
  });

  it('keeps a weekly pick through Sunday night and lets it go on Monday', async () => {
    const { keep, clock } = setUp();

    await keep.keep(CHOICE, 'weekly');

    clock.set(new Date(2026, 10, 15, 23, 59));
    expect((await keep.current())?.text).toBe(CHOICE.text);

    clock.set(new Date(2026, 10, 16, 0, 0));
    expect(await keep.current()).toBeNull();
  });

  it('lets a daily pick go the next day', async () => {
    const { keep, clock } = setUp();

    await keep.keep(CHOICE, 'daily');

    clock.set(new Date(2026, 10, 10, 8, 0));
    expect(await keep.current()).toBeNull();
  });

  it('keeps a monthly pick until the month is over', async () => {
    const { keep, clock } = setUp();

    await keep.keep(CHOICE, 'monthly');

    clock.set(new Date(2026, 10, 30, 21, 0));
    expect(await keep.current()).not.toBeNull();

    clock.set(new Date(2026, 11, 1, 0, 0));
    expect(await keep.current()).toBeNull();
  });

  it('puts a new pick in place of the last one', async () => {
    const { keep, clock } = setUp();

    await keep.keep(CHOICE, 'daily');
    clock.set(new Date(2026, 10, 10, 10, 0));
    await keep.keep({ ...CHOICE, key: 'affirmation.say7', text: 'Rest counts.' }, 'daily');

    expect((await keep.current())?.key).toBe('affirmation.say7');
  });
});
