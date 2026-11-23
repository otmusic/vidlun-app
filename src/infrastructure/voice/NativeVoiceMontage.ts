import { Directory, File, Paths } from 'expo-file-system';

import type {
  IVoiceMontage,
  Montage,
  MontagePiece,
  MontageSpan,
  MontageTiming,
} from '../../domain/ports/IVoiceMontage';

/** The cache folder a month heard in its own voice is written to, swept at launch. */
export const MONTH_VOICE = 'month-voice';

/** The voice module's two calls, injected so the adapter is testable without it. */
export interface MontageNative {
  readonly lengths: (uris: readonly string[]) => Promise<unknown> | null;
  readonly compose: (pieces: readonly MontagePiece[], out: string, timing: MontageTiming) => Promise<unknown> | null;
}

/**
 * Takes joined by the voice module on the phone, into the cache. Only the
 * last joined file is kept: joining another removes it first, so a month's
 * voice never piles up. What comes back over the bridge is checked rather
 * than trusted.
 */
export class NativeVoiceMontage implements IVoiceMontage {
  private last: { readonly key: string; readonly montage: Montage } | null = null;
  /**
   * One join or clear at a time: each starts by emptying the folder, so a
   * second one begun while the first is still writing would take its file.
   */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly native: MontageNative) {}

  async lengths(uris: readonly string[]): Promise<readonly (number | null)[] | null> {
    const pending = this.native.lengths(uris);

    if (pending === null) {
      return null;
    }

    const raw = await pending;

    if (!Array.isArray(raw) || raw.length !== uris.length) {
      return null;
    }

    return (raw as unknown[]).map((ms) => (typeof ms === 'number' && ms > 0 ? ms : null));
  }

  join(pieces: readonly MontagePiece[], timing: MontageTiming): Promise<Montage | null> {
    const run = this.queue.then(() => this.joinNow(pieces, timing));

    this.queue = run.catch(() => undefined);

    return run;
  }

  clear(): Promise<void> {
    const run = this.queue.then(() => {
      this.removeAll();
    });

    this.queue = run.catch(() => undefined);

    return run;
  }

  private async joinNow(pieces: readonly MontagePiece[], timing: MontageTiming): Promise<Montage | null> {
    const key = keyOf(pieces, timing);

    if (this.last !== null && this.last.key === key && new File(this.last.montage.uri).exists) {
      return this.last.montage;
    }

    this.removeAll();

    const folder = new Directory(Paths.cache, MONTH_VOICE);

    folder.create({ intermediates: true, idempotent: true });

    const out = new File(folder, `${key}.m4a`);
    const pending = this.native.compose(pieces, out.uri, timing);

    if (pending === null) {
      return null;
    }

    const spans = spansFrom(await pending, pieces.length);

    if (spans === null || spans.every((span) => span === null) || !out.exists) {
      return null;
    }

    const montage = { uri: out.uri, spans };

    this.last = { key, montage };

    return montage;
  }

  private removeAll(): void {
    this.last = null;

    try {
      const folder = new Directory(Paths.cache, MONTH_VOICE);

      if (folder.exists) {
        folder.delete();
      }
    } catch {
      // Left to the sweep at the next launch.
    }
  }
}

/** One [start, end] pair per piece, or null when the answer is not that shape. */
export function spansFrom(raw: unknown, count: number): (MontageSpan | null)[] | null {
  if (!Array.isArray(raw) || raw.length !== count) {
    return null;
  }

  return (raw as unknown[]).map((pair) =>
    Array.isArray(pair) &&
    typeof pair[0] === 'number' &&
    typeof pair[1] === 'number' &&
    pair[0] >= 0 &&
    pair[1] > pair[0]
      ? { startMs: pair[0], endMs: pair[1] }
      : null,
  );
}

/** A short name that changes whenever the pieces or their timing do. */
export function keyOf(pieces: readonly MontagePiece[], timing: MontageTiming): string {
  const text = JSON.stringify([pieces, timing]);
  let hash = 5381;

  for (let at = 0; at < text.length; at += 1) {
    hash = ((hash * 33) ^ text.charCodeAt(at)) >>> 0;
  }

  return `month-${hash.toString(36)}-${pieces.length}`;
}
