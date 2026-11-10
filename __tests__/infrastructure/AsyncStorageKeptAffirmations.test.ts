import type { KeptAffirmation } from '@/domain/entities/KeptAffirmation';
import { AsyncStorageKeptAffirmations } from '@/infrastructure/affirmations/AsyncStorageKeptAffirmations';
import { InMemoryKeyValueStore } from './fakes';

const KEPT: KeptAffirmation = {
  key: 'affirmation.say3',
  text: 'Slow is still forward.',
  look: { shape: 'flower', tint: 2, glyph: 'coffee' },
  frequency: 'weekly',
  pickedAt: new Date('2026-11-09T08:05:00.000Z'),
  until: new Date('2026-11-15T22:00:00.000Z'),
};

describe('AsyncStorageKeptAffirmations', () => {
  it('has nothing on a first run', async () => {
    expect(await new AsyncStorageKeptAffirmations(new InMemoryKeyValueStore()).read()).toBeNull();
  });

  it('reads back what it wrote, dates included', async () => {
    const kept = new AsyncStorageKeptAffirmations(new InMemoryKeyValueStore());

    await kept.write(KEPT);

    expect(await kept.read()).toEqual(KEPT);
  });

  it.each([
    ['not JSON', '{'],
    ['not an object', '"words"'],
    ['without its words', JSON.stringify({ ...KEPT, text: undefined })],
    ['with an unknown period', JSON.stringify({ ...KEPT, frequency: 'yearly' })],
    ['with a date that is not one', JSON.stringify({ ...KEPT, until: 'soon' })],
    ['without its look', JSON.stringify({ ...KEPT, look: null })],
  ])('reads a record %s as nothing kept', async (_label, raw) => {
    const store = new InMemoryKeyValueStore();

    await store.setItem('vidlun.keptAffirmation', raw);

    expect(await new AsyncStorageKeptAffirmations(store).read()).toBeNull();
  });
});
