import { AppleStoreListing } from '@/infrastructure/store/AppleStoreListing';

function answering(status: number, body: unknown): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('the App Store listing', () => {
  it('reads the version on sale and the page it is sold from', async () => {
    const listing = new AppleStoreListing(
      '6806530807',
      answering(200, {
        resultCount: 1,
        results: [{ version: '1.8', trackViewUrl: 'https://apps.apple.com/us/app/id6806530807' }],
      }),
    );

    expect(await listing.latest()).toEqual({
      version: '1.8',
      url: 'https://apps.apple.com/us/app/id6806530807',
    });
  });

  it('says nothing when the store does not list the app', async () => {
    const listing = new AppleStoreListing('6806530807', answering(200, { resultCount: 0, results: [] }));

    expect(await listing.latest()).toBeNull();
  });

  it('says nothing when the store answers with an error', async () => {
    const listing = new AppleStoreListing('6806530807', answering(503, {}));

    expect(await listing.latest()).toBeNull();
  });

  it('says nothing when the answer is not the shape it should be', async () => {
    const listing = new AppleStoreListing('6806530807', answering(200, { results: [{ version: 18 }] }));

    expect(await listing.latest()).toBeNull();
  });
});
