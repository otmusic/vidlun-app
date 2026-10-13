import { FindRecordedEntries } from '@/application/use-cases/FindRecordedEntries';
import { InMemoryRecordingStore } from './fakes';

describe('which entries still have their audio', () => {
  it('names the entries whose recording is kept, and no others', async () => {
    const recordings = new InMemoryRecordingStore();

    await recordings.keep('spoken', 'file:///take.wav');
    await recordings.keep('deleted', 'file:///other.wav');
    await recordings.discard('deleted');

    expect([...(await new FindRecordedEntries(recordings).execute())]).toEqual(['spoken']);
  });
});
