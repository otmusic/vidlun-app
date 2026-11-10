import type { IStoreListing, StoreRelease } from '../../domain/ports/IStoreListing';

/**
 * Whether the store sells a newer version than the one installed, for the
 * "update" line on home (owner's word, 2026-11-05). Anything short of a clear
 * yes is a no: an unreachable store, an unknown version, or a build ahead of
 * the store, as one in review is.
 */
export class CheckForUpdate {
  constructor(
    private readonly listing: IStoreListing,
    /** Null when the build does not say which version it is. */
    private readonly installed: string | null,
  ) {}

  async execute(): Promise<StoreRelease | null> {
    if (this.installed === null) {
      return null;
    }

    const release = await this.listing.latest().catch(() => null);

    return release !== null && isNewer(release.version, this.installed) ? release : null;
  }
}

/** Dotted versions compared part by part as numbers, a missing part as zero. */
function isNewer(candidate: string, current: string): boolean {
  const a = parts(candidate);
  const b = parts(current);

  for (let at = 0; at < Math.max(a.length, b.length); at += 1) {
    const difference = (a[at] ?? 0) - (b[at] ?? 0);

    if (difference !== 0) {
      return difference > 0;
    }
  }

  return false;
}

function parts(version: string): readonly number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}
