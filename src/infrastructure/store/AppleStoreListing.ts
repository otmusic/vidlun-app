import type { IStoreListing, StoreRelease } from '../../domain/ports/IStoreListing';

const LOOKUP = 'https://itunes.apple.com/lookup';

/**
 * The App Store's public lookup, asked by the app's id. Nothing about the
 * person goes with it: the id is the app's, and the answer is the same for
 * everyone. Apple's own cache can trail a release by some hours, which only
 * means the line on home turns up a little late.
 */
export class AppleStoreListing implements IStoreListing {
  constructor(
    private readonly appId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async latest(): Promise<StoreRelease | null> {
    const response = await this.fetcher(`${LOOKUP}?id=${this.appId}`);

    if (!response.ok) {
      return null;
    }

    return releaseIn(await response.json());
  }
}

function releaseIn(body: unknown): StoreRelease | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const results: unknown = (body as { results?: unknown }).results;
  const first: unknown = Array.isArray(results) ? results[0] : undefined;

  if (typeof first !== 'object' || first === null) {
    return null;
  }

  const { version, trackViewUrl } = first as { version?: unknown; trackViewUrl?: unknown };

  return typeof version === 'string' && typeof trackViewUrl === 'string'
    ? { version, url: trackViewUrl }
    : null;
}
