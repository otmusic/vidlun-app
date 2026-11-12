import { VoiceReading } from '@/domain/value-objects/VoiceReading';
import { AsyncStorageVoiceReadings } from '@/infrastructure/persistence/AsyncStorageVoiceReadings';

import { InMemoryKeyValueStore } from './fakes';

function reading(loudnessDb: number): VoiceReading {
  const made = VoiceReading.from({ version: 1, speechMs: 5000, loudnessDb });

  if (made === null) {
    throw new Error('not a reading');
  }

  return made;
}

describe('the voice readings kept on the phone', () => {
  it('keeps a reading per entry and finds it again', async () => {
    const readings = new AsyncStorageVoiceReadings(new InMemoryKeyValueStore());

    await readings.save('e1', reading(-20));
    await readings.save('e2', reading(-30));
    await readings.save('e1', reading(-25));

    expect((await readings.find('e1'))?.loudnessDb).toBe(-25);
    expect([...(await readings.all()).keys()]).toEqual(['e1', 'e2']);
  });

  it('forgets one without touching the others, and clears the key when none are left', async () => {
    const store = new InMemoryKeyValueStore();
    const readings = new AsyncStorageVoiceReadings(store);

    await readings.save('e1', reading(-20));
    await readings.save('e2', reading(-30));
    await readings.forget('e1');
    await readings.forget('never-there');

    expect(await readings.find('e1')).toBeNull();
    expect(await readings.find('e2')).not.toBeNull();

    await readings.clear();

    expect((await readings.all()).size).toBe(0);
    expect(await store.getItem('vidlun.voiceReadings')).toBeNull();
  });

  it('does not lose a reading saved while another is being forgotten', async () => {
    const readings = new AsyncStorageVoiceReadings(new InMemoryKeyValueStore());

    await readings.save('e1', reading(-20));
    await Promise.all([readings.forget('e1'), readings.save('e2', reading(-30))]);

    expect([...(await readings.all()).keys()]).toEqual(['e2']);
  });

  it('reads damaged storage as no readings, and skips one that is not a reading', async () => {
    const store = new InMemoryKeyValueStore();

    await store.setItem('vidlun.voiceReadings', '{not json');
    expect((await new AsyncStorageVoiceReadings(store).all()).size).toBe(0);

    await store.setItem('vidlun.voiceReadings', JSON.stringify({ e1: { version: 1, speechMs: 10 }, e2: 'loud' }));
    expect([...(await new AsyncStorageVoiceReadings(store).all()).keys()]).toEqual(['e1']);
  });
});
