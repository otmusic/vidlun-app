import { CheckForUpdate } from '@/application/use-cases/CheckForUpdate';
import type { IStoreListing, StoreRelease } from '@/domain/ports/IStoreListing';

const URL = 'https://apps.apple.com/app/id6806530807';

class Listing implements IStoreListing {
  constructor(private readonly answer: StoreRelease | null | Error) {}

  latest(): Promise<StoreRelease | null> {
    return this.answer instanceof Error ? Promise.reject(this.answer) : Promise.resolve(this.answer);
  }
}

function check(store: string | null | Error, installed: string | null) {
  const answer = typeof store === 'string' ? { version: store, url: URL } : store;

  return new CheckForUpdate(new Listing(answer), installed).execute();
}

describe('telling someone a newer version is out', () => {
  it('offers the store’s release when it is newer than the one installed', async () => {
    expect(await check('1.9', '1.8')).toEqual({ version: '1.9', url: URL });
  });

  it('offers nothing when the installed version is the store’s', async () => {
    expect(await check('1.8', '1.8')).toBeNull();
  });

  it('offers nothing to a build ahead of the store, such as one in review', async () => {
    expect(await check('1.8', '1.9')).toBeNull();
  });

  it('compares the parts as numbers, so 1.10 is newer than 1.9', async () => {
    expect(await check('1.10', '1.9')).not.toBeNull();
  });

  it('reads a missing part as zero, so 1.9 and 1.9.0 are the same', async () => {
    expect(await check('1.9.0', '1.9')).toBeNull();
    expect(await check('1.9.1', '1.9')).not.toBeNull();
  });

  it('offers nothing when the store cannot be reached', async () => {
    expect(await check(new Error('offline'), '1.8')).toBeNull();
  });

  it('offers nothing when the store does not list the app', async () => {
    expect(await check(null, '1.8')).toBeNull();
  });

  it('offers nothing when the installed version is unknown', async () => {
    expect(await check('1.9', null)).toBeNull();
  });
});
